#!/usr/bin/env bun

import { program } from 'commander'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const TEMPLATE_DIR = join(dirname(import.meta.path), '..', 'template')

program
	.name('create-opencode-plugin')
	.description('Create a new OpenCode plugin project')
	.argument('[directory]', 'Directory to create the plugin in', '.')
	.action(async (directory: string) => {
		await create(directory)
	})

program.parse()

async function create(directory: string): Promise<void> {
	const targetDir = resolve(directory)
	const name = directory === '.' ? basename(process.cwd()) : basename(targetDir)

	console.log()
	console.log(`Creating OpenCode plugin in ${targetDir}...`)

	// Create target directory if it doesn't exist
	if (!existsSync(targetDir)) {
		mkdirSync(targetDir, { recursive: true })
	}

	// Check if directory is empty (except for hidden files)
	const existing = readdirSync(targetDir).filter((f) => !f.startsWith('.'))
	if (existing.length > 0) {
		console.error(`Error: Directory "${targetDir}" is not empty.`)
		console.error('Please use an empty directory or remove existing files.')
		process.exit(1)
	}

	// Fetch latest versions
	console.log('Fetching latest @opencode-ai package versions...')
	const [pluginVersion, sdkVersion] = await Promise.all([
		getLatestVersion('@opencode-ai/plugin'),
		getLatestVersion('@opencode-ai/sdk'),
	])
	console.log(`  @opencode-ai/plugin: ${pluginVersion}`)
	console.log(`  @opencode-ai/sdk: ${sdkVersion}`)

	const packageName = toPackageName(name)
	const pluginName = toPascalCase(name) + 'Plugin'

	const replacements: Record<string, string> = {
		'{{PACKAGE_NAME}}': packageName,
		'{{PLUGIN_NAME}}': pluginName,
		'{{OPENCODE_PLUGIN_VERSION}}': pluginVersion,
		'{{OPENCODE_SDK_VERSION}}': sdkVersion,
	}

	// Copy template files
	copyDir(TEMPLATE_DIR, targetDir, replacements)

	console.log()
	console.log('Done! Next steps:')
	console.log()
	if (targetDir !== process.cwd()) {
		console.log(`  cd ${basename(targetDir)}`)
	}
	console.log('  bun install')
	console.log('  bun dev')
	console.log()
	console.log('To publish your plugin:')
	console.log()
	console.log('  npm publish')
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
