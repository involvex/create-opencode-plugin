import { Command, Plugin } from '@opencode/plugin/gui'

/**
 * {{PLUGIN_NAME}} GUI Plugin (Desktop)
 */

export default Plugin.define({
	id: '{{PACKAGE_NAME}}',
	setup(ctx) {
		ctx.add(Command, () => ({
			id: 'hello',
			title: 'Hello from {{PLUGIN_NAME}}',
			run: () => {
				console.log('[{{PACKAGE_NAME}}] Hello')
			},
		}))
	},
})
