import { Command, Plugin } from '@opencode/plugin/gui'
import { Plugin as ServerPlugin } from '@opencode/plugin'

/**
 * {{PLUGIN_NAME}} GUI Plugin (Desktop)
 *
 * Documentation: https://opencode.ai/v2/docs/build/plugins/gui
 *
 * This file runs in both processes:
 * - setup() runs in every desktop window
 * - main() runs once in the Electron main process
 */

export default Plugin.define({
	id: '{{PACKAGE_NAME}}',
	i18n: {
		en: {
			'command.example': 'Example Command',
			'panel.title': '{{PLUGIN_NAME}}',
		},
	},
	setup(ctx) {
		console.log('[{{PACKAGE_NAME}}] GUI setup in window')

		ctx.add(Command, () => ({
			id: 'example',
			title: ctx.t('command.example'),
			description: 'Example command from {{PLUGIN_NAME}}',
			run: () => {
				console.log('[{{PACKAGE_NAME}}] Example command executed')
			},
		}))
	},
	main(ctx) {
		console.log('[{{PACKAGE_NAME}}] GUI main in Electron process')
	},
})
