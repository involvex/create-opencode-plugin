#!/usr/bin/env node

import * as p from '@clack/prompts'
import { Option, program } from 'commander'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_FULL_DIR = join(__dirname, '..', 'template')
const TEMPLATE_MINIMAL_DIR = join(__dirname, '..', 'template-minimal')

interface ScaffoldOptions {
	directory: string
	name: string
	description: string
	author: string
	templateType: 'full' | 'minimal'
	git: boolean
	install: boolean
	packageManager?: string
}

program
	.name('create-opencode-plugin')
	.description('Create a new OpenCode plugin project')
	.argument('[directory]', 'Directory to create the plugin in')
	.addOption(new Option('-t, --template <type>', 'Template type').choices(['full', 'minimal']))
	.addOption(new Option('-i, --install', 'Install dependencies automatically').default(true))
	.addOption(new Option('--no-install', 'Skip dependency installation'))
	.addOption(new Option('-g, --git', 'Initialize a Git repository').default(true))
	.addOption(new Option('--no-git', 'Skip Git initialization'))
	.addOption(
		new Option('-p, --package-manager <pm>', 'Package manager to use').choices([
			'bun',
			'npm',
			'pnpm',
			'yarn',
		]),
	)
	.addOption(new Option('--no-prompts', 'Skip interactive prompts (use defaults)'))
	.action(async (directory: string | undefined, options: Record<string, unknown>) => {
		try {
			await create(directory, options)
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err)
			p.log.error(`Scaffolding failed: ${message}`)
			process.exit(1)
		}
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

function validatePackageName(value: string | undefined): string | undefined {
	if (!value) return 'Package name is required'
	if (value.length > 214) return 'Package name must be less than 214 characters'
	if (/[A-Z]/.test(value)) return 'Package name must be lowercase'
	if (/^[._]/.test(value)) return 'Package name cannot start with a dot or underscore'
	if (value.trim() !== value) return 'Package name cannot have leading/trailing whitespace'
	const reserved = ['node_modules', 'favicon.ico']
	if (reserved.includes(value)) return `"${value}" is a reserved name`
}

async function getLatestVersion(packageName: string): Promise<string> {
	try {
		const res = await fetch(`https://registry.npmjs.org/${packageName}/latest`)
		if (!res.ok) throw new Error(`Failed to fetch ${packageName}`)
		const data = (await res.json()) as { version: string }
		return `^${data.version}`
	} catch {
		return '^1.1.44'
	}
}

async function getVersions(): Promise<{ pluginVersion: string; sdkVersion: string }> {
	const sVersions = p.spinner()
	sVersions.start('Fetching latest @opencode-ai package versions...')
	try {
		const [pluginVersion, sdkVersion] = await Promise.all([
			getLatestVersion('@opencode-ai/plugin'),
			getLatestVersion('@opencode-ai/sdk'),
		])
		sVersions.stop('Package versions resolved.')
		return { pluginVersion, sdkVersion }
	} catch {
		sVersions.stop('Could not fetch versions. Using fallback versions.')
		return { pluginVersion: '^1.1.44', sdkVersion: '^1.1.44' }
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

function countFiles(dir: string): number {
	let count = 0
	try {
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry)
			const s = statSync(fullPath)
			if (s.isDirectory()) {
				count += countFiles(fullPath)
			} else {
				count++
			}
		}
	} catch {
		// ignore
	}
	return count
}

async function create(
	initialDirectory: string | undefined,
	options: Record<string, unknown>,
): Promise<void> {
	p.intro('Create a new OpenCode Plugin')

	const skipPrompts = options.noPrompts === true || process.env.MOCK_PROMPTS === 'true'
	const cliTemplate = options.template as 'full' | 'minimal' | undefined

	const defaults = {
		directory: initialDirectory || './my-opencode-plugin',
	}

	let results: ScaffoldOptions

	if (skipPrompts) {
		const resolvedDir = resolve(initialDirectory || defaults.directory)
		results = {
			directory: initialDirectory || defaults.directory,
			name: toPackageName(basename(resolvedDir)),
			description: 'An awesome OpenCode plugin',
			author: getGitAuthor() || 'Test Author',
			templateType: cliTemplate || 'full',
			git: options.git !== false,
			install: options.install !== false,
			packageManager: typeof options.packageManager === 'string' ? options.packageManager : 'bun',
		}
	} else {
		const groupResult = await p.group(
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
				templateType: () => {
					if (cliTemplate) return Promise.resolve(cliTemplate)
					return p.select({
						message: 'Which template would you like to use?',
						options: [
							{
								value: 'full',
								label: 'Full (Recommended)',
								hint: 'All hooks stubbed, ready to customize',
							},
							{
								value: 'minimal',
								label: 'Minimal',
								hint: 'Bare-bones: custom tool + a few hooks',
							},
						],
						initialValue: 'full',
					}) as Promise<'full' | 'minimal'>
				},
				name: ({ results: r }) =>
					p.text({
						message: 'What is the package name?',
						placeholder: toPackageName(basename(resolve((r as { directory: string }).directory))),
						defaultValue: toPackageName(basename(resolve((r as { directory: string }).directory))),
						validate: validatePackageName,
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
						initialValue: options.git !== false,
					}),
				install: () =>
					p.confirm({
						message: 'Install dependencies automatically?',
						initialValue: options.install !== false,
					}),
				packageManager: ({ results: r }) => {
					if (!(r as { install: boolean }).install) return Promise.resolve(undefined)
					return p.select({
						message: 'Select package manager to use:',
						options: [
							{ value: 'bun', label: 'Bun' },
							{ value: 'npm', label: 'NPM' },
							{ value: 'pnpm', label: 'PNPM' },
							{ value: 'yarn', label: 'Yarn' },
						],
						initialValue: 'bun',
					}) as Promise<string | undefined>
				},
			},
			{
				onCancel: () => {
					p.cancel('Scaffolding cancelled.')
					process.exit(0)
				},
			},
		)

		results = {
			directory: groupResult.directory as string,
			name: groupResult.name as string,
			description: groupResult.description as string,
			author: groupResult.author as string,
			templateType: (groupResult.templateType || 'full') as 'full' | 'minimal',
			git: groupResult.git as boolean,
			install: groupResult.install as boolean,
			packageManager: groupResult.packageManager as string | undefined,
		}
	}

	const targetDir = resolve(results.directory)

	if (!existsSync(targetDir)) {
		try {
			mkdirSync(targetDir, { recursive: true })
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Unknown error'
			if (message.includes('EACCES') || message.includes('EPERM')) {
				throw new Error(`Permission denied creating directory: ${targetDir}`, { cause: err })
			}
			throw new Error(`Failed to create directory: ${message}`, { cause: err })
		}
	}

	const { pluginVersion, sdkVersion } = await getVersions()

	const baseName = results.name.includes('/') ? results.name.split('/').pop()! : results.name
	const pluginName = toPascalCase(baseName) + 'Plugin'

	const templateDir = results.templateType === 'minimal' ? TEMPLATE_MINIMAL_DIR : TEMPLATE_FULL_DIR

	const replacements: Record<string, string> = {
		'{{PACKAGE_NAME}}': results.name,
		'{{PLUGIN_NAME}}': pluginName,
		'{{OPENCODE_PLUGIN_VERSION}}': pluginVersion,
		'{{OPENCODE_SDK_VERSION}}': sdkVersion,
		'{{DESCRIPTION}}': results.description || 'OpenCode plugin',
		'{{AUTHOR}}': results.author || '',
	}

	const sCopy = p.spinner()
	sCopy.start('Generating plugin files...')
	copyDir(templateDir, targetDir, replacements)
	const fileCount = countFiles(targetDir)
	sCopy.stop(`Plugin files generated! (${fileCount} files)`)

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
			p.log.warn(`Please run "${results.packageManager} install" manually.`)
		}
	}

	const displayPath = targetDir !== process.cwd() ? basename(targetDir) : '.'
	const steps: string[] = []
	if (!results.install) steps.push(`cd ${displayPath} && bun install`)
	steps.push('bun run setup')
	steps.push('bun dev')

	p.note(
		[
			'Target: ' + displayPath,
			'Template: ' + results.templateType,
			'',
			...steps.map((s, i) => `${i + 1}. ${s}`),
			'',
			'To remove from global config later:',
			'  bun run unregister',
		].join('\n'),
		'Next steps',
	)

	p.outro('OpenCode plugin project created successfully!')
}
