import { Plugin, PluginInput, tool } from '@opencode-ai/plugin'

/**
 * {{PLUGIN_NAME}} - OpenCode Plugin (Minimal)
 *
 * Documentation: https://opencode.ai/docs/plugins/
 * SDK Reference: https://opencode.ai/docs/sdk/
 */
export const {{PLUGIN_NAME}}: Plugin = async (ctx: PluginInput) => {
	await ctx.client.app.log({
		body: {
			service: '{{PACKAGE_NAME}}',
			level: 'info',
			message: 'plugin initialized',
		},
	})

	return {
		tool: {
			greet: tool({
				description: 'Greet a person by name. Call this tool whenever you want to greet someone.',
				args: {
					name: tool.schema.string({ description: 'The name of the person to greet' }),
				},
				async execute(args) {
					return `Hello, ${args.name}!`
				},
			}),
		},

		'tool.execute.before': async (input, output) => {
			if (input.tool === 'read' && output.args.filePath.includes('.env')) {
				throw new Error('Cannot read .env files')
			}
		},

		event: async ({ event }) => {
			if (event.type === 'session.idle') {
				await ctx.client.app.log({
					body: {
						service: '{{PACKAGE_NAME}}',
						level: 'info',
						message: 'session completed',
					},
				})
			}
		},
	}
}