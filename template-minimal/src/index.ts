import { Plugin } from '@opencode/plugin'
import { Effect, Schema } from 'effect'

/**
 * {{PLUGIN_NAME}} - OpenCode Plugin (V2, Minimal)
 *
 * Documentation: https://opencode.ai/v2/docs/build/plugins
 * SDK Reference: https://opencode.ai/v2/docs/sdk
 */
export default Plugin.define({
	id: '{{PACKAGE_NAME}}',
	setup(ctx) {
		// ctx provides domain services:
		// - app: { name, version, channel }
		// - location: { directory, project: { id, directory, canonical } }
		// - options: Readonly<Record<string, any>> — plugin options from config
		// - storage: { get, set, remove, scan } — persisted key-value state
		// - tool: ToolDomain — transform, list, hook
		// - session: SessionDomain — hook
		// - event: EventDomain — subscribe
		// - permission: PermissionDomain — hook('evaluate')
		// - shell: ShellDomain — hook('create.before')
		// - command: CommandDomain — transform
		// - etc.

		console.log('[{{PACKAGE_NAME}}] plugin initialized')

		// Register a custom tool using Effect's Schema for input definition
		ctx.tool.transform((editor) => {
			editor.add({
				name: 'greet',
				description: 'Greet a person by name. Call this tool whenever you want to greet someone.',
				input: Schema.Struct({
					name: Schema.String({ description: 'The name of the person to greet' }),
				}),
				execute: ({ name }) => {
					return Effect.succeed({
						content: [{ type: 'text' as const, text: `Hello, ${name}!` }],
					})
				},
			})
		})

		// Block reading .env files (throw to prevent execution)
		ctx.tool.hook('execute.before', ({ tool, input }) => {
			if (tool === 'read' && String(input).includes('.env')) {
				throw new Error('Cannot read .env files')
			}
		})

		// Subscribe to events — log when a session completes
		ctx.event.subscribe(({ event }) => {
			if (event.type === 'session.idle') {
				console.log('[{{PACKAGE_NAME}}] session completed')
			}
		})

		return async () => {
			console.log('[{{PACKAGE_NAME}}] plugin cleaned up')
		}
	},
})
