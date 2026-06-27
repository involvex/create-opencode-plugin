#!/usr/bin/env node

import * as p from '@clack/prompts'
import { program } from 'commander'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, '..', 'template')

program
	.name('create-opencode-plugin')
	.description('Create a new OpenCode plugin project')
	.argument('[directory]', 'Directory to create the plugin in')
	.action(async (directory?: string) => {
		await create(directory)
	})

program.parse()

function getGitAuthor(): string {
	try {
		const name = execSync('git config user.name', {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim()
		const email = execSync('git config user.email', {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'ignore'],
		}).trim()
		if (name && email) {
			return `${name} <${email}>`
		} else if (name) {
			return name
		}
	} catch {
		// Ignore git config errors
	}
	return ''
}

async function create(initialDirectory?: string): Promise<void> {
	p.intro('Create a new OpenCode Plugin')

	const defaults = {
		directory: initialDirectory || './my-opencode-plugin',
	}

	let results: any
	if (process.env.MOCK_PROMPTS === 'true') {
		results = {
			directory: defaults.directory,
			name: toPackageName(basename(resolve(defaults.directory))),
			description: 'An awesome OpenCode plugin',
			author: getGitAuthor() || 'Test Author',
			git: true,
			install: false,
			packageManager: undefined,
		}
	} else {
		results = (await p.group(
			{
				directory: () =>
					p.text({
						message: 'Where should the plugin be created?',
						placeholder: defaults.directory,
						defaultValue: defaults.directory,
						validate(value) {
							if (!value) return 'Directory path is required'
							const targetDir = resolve(value)
							if (existsSync(targetDir)) {
								try {
									const files = readdirSync(targetDir).filter((f) => !f.startsWith('.'))
									if (files.length > 0) {
										return `Directory "${value}" is not empty. Please use an empty directory.`
									}
								} catch {
									// Dir might not exist yet, which is fine
								}
							}
						},
					}),
				name: ({ results: r }) =>
					p.text({
						message: 'What is the package name?',
						placeholder: toPackageName(basename(resolve((r as any).directory!))),
						defaultValue: toPackageName(basename(resolve((r as any).directory!))),
						validate(value) {
							if (!value) return 'Package name is required'
						},
					}),
				description: () =>
					p.text({
						message: 'Enter plugin description:',
						placeholder: 'An awesome OpenCode plugin',
						defaultValue: 'An awesome OpenCode plugin',
					}),
				author: () =>
					p.text({
						message: 'Enter author name:',
						placeholder: getGitAuthor() || 'Author Name',
						defaultValue: getGitAuthor(),
					}),
				git: () =>
					p.confirm({
						message: 'Initialize a Git repository?',
						initialValue: true,
					}),
				install: () =>
					p.confirm({
						message: 'Install dependencies automatically?',
						initialValue: true,
					}),
				packageManager: ({ results: r }) => {
					if (!(r as any).install) return Promise.resolve(undefined)
					return p.select({
						message: 'Select package manager to use:',
						options: [
							{ value: 'bun', label: 'Bun' },
							{ value: 'npm', label: 'NPM' },
							{ value: 'pnpm', label: 'PNPM' },
							{ value: 'yarn', label: 'Yarn' },
						],
						initialValue: 'bun',
					})
				},
			},
			{
				onCancel: () => {
					p.cancel('Scaffolding cancelled.')
					process.exit(0)
				},
			},
		)) as any
	}

	const targetDir = resolve(results.directory)
	const name = results.name

	// Create target directory if it doesn't exist
	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true })
	}

	// Fetch latest versions
	const sVersions = p.spinner()
	sVersions.start('Fetching latest @opencode-ai package versions...')
	const [pluginVersion, sdkVersion] = await Promise.all([
		getLatestVersion('@opencode-ai/plugin'),
		getLatestVersion('@opencode-ai/sdk'),
	])
	sVersions.stop('Package versions resolved.')

	const baseName = name.includes('/') ? name.split('/').pop()! : name
	const pluginName = toPascalCase(baseName) + 'Plugin'

	const replacements: Record<string, string> = {
		'{{PACKAGE_NAME}}': name,
		'{{PLUGIN_NAME}}': pluginName,
		'{{OPENCODE_PLUGIN_VERSION}}': pluginVersion,
		'{{OPENCODE_SDK_VERSION}}': sdkVersion,
		'{{DESCRIPTION}}': results.description || 'OpenCode plugin',
		'{{AUTHOR}}': results.author || '',
	}

	// Copy template files
	const sCopy = p.spinner()
	sCopy.start('Generating plugin files...')
	copyDir(TEMPLATE_DIR, targetDir, replacements)
	sCopy.stop('Plugin files generated!')

	// Initialize git if selected
	if (results.git) {
		const sGit = p.spinner()
		sGit.start('Initializing Git repository...')
		try {
			execSync('git init', { cwd: targetDir, stdio: 'ignore' })
			execSync('git add -A', { cwd: targetDir, stdio: 'ignore' })
			sGit.stop('Git repository initialized and files staged!')
		} catch {
			sGit.stop('Failed to initialize Git repository.')
		}
	}

	// Install dependencies if selected
	if (results.install && results.packageManager) {
		const sInstall = p.spinner()
		sInstall.start(`Installing dependencies using ${results.packageManager}...`)
		try {
			execSync(`${results.packageManager} install`, {
				cwd: targetDir,
				stdio: 'ignore',
			})
			sInstall.stop('Dependencies installed successfully!')
		} catch {
			sInstall.stop('Failed to install dependencies.')
			p.note(`Please run "${results.packageManager} install" manually.`, 'Warning')
		}
	}

	p.outro('OpenCode plugin project created successfully!')

	console.log('Next steps:')
	console.log()
	if (targetDir !== process.cwd()) {
		console.log(`  cd ${basename(targetDir)}`)
	}
	if (!results.install) {
		console.log('  bun install  (or npm install)')
	}
	console.log('  bun dev      (or npm run dev)')
	console.log()
}

async function getLatestVersion(packageName: string): Promise<string> {
	try {
		const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
		if (!res.ok) throw new Error(`Failed to fetch ${packageName}`)
		const data = (await res.json()) as { version: string }
		return `^${data.version}`
	} catch {
		// Fallback to a reasonable default
		return '^1.1.44'
	}
}

function copyDir(src: string, dest: string, replacements: Record<string, string>): void {
	mkdirSync(dest, { recursive: true })

	for (const entry of readdirSync(src)) {
		const srcPath = join(src, entry)
		const destPath = join(dest, entry)
		const stat = statSync(srcPath)

		if (stat.isDirectory()) {
			copyDir(srcPath, destPath, replacements)
		} else {
			let content = readFileSync(srcPath, 'utf-8')
			for (const [key, value] of Object.entries(replacements)) {
				content = content.replaceAll(key, value)
			}
			writeFileSync(destPath, content)
		}
	}
}

function toPackageName(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9-]/g, '-')
		.replace(/-+/g, '-')
		.replace(/^-|-$/g, '')
}

function toPascalCase(name: string): string {
	return name
		.split(/[-_\s]+/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join('')
}
