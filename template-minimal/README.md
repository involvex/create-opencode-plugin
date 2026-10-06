# {{PACKAGE_NAME}}

OpenCode V2 plugin (minimal).

## Installation

Add to your `opencode.json` (global or per-project) using the V2 config format:

```json
{
	"plugins": [
		{ "package": "{{PACKAGE_NAME}}@latest" }
	]
}
```

OpenCode will automatically install the plugin on next launch.

## Quick Start (Global Registration)

```bash
bun run setup
```

Then **restart OpenCode** — your plugin is live.

To remove it:

```bash
bun run unregister
```

## Development

```bash
bun install
bun dev       # run OpenCode with plugin loaded from source
bun typecheck # verify types
bun check     # format, lint, typecheck
```

## Included Hooks

This minimal template includes:

- **`ctx.tool` (greet)** — A custom tool that greets a person by name
  - Registered via `ctx.tool.transform((editor) => { editor.add({ ... }) })`
  - Uses Effect `Schema.Struct` for input validation
- **`ctx.tool.hook('execute.before')`** — Blocks reading `.env` files
- **`ctx.event.subscribe`** — Logs when a session completes

## Plugin Architecture (V2)

```typescript
import { Plugin } from '@opencode/plugin'

export default Plugin.define({
	id: '{{PACKAGE_NAME}}',
	setup(ctx) {
		// ctx provides domain services:
		// - app: { name, version, channel }
		// - location: { directory, project }
		// - options: PluginOptions
		// - storage: { get, set, remove, scan }
		// - tool: ToolDomain — transform, list, hook
		// - session: SessionDomain — hook
		// - event: subscribe
		// - permission: hook('evaluate')
		// - shell: hook('create.before')
		// - etc.

		return async () => {
			// optional cleanup
		}
	},
})
```

## Resources

- [Plugin Documentation](https://opencode.ai/v2/docs/build/plugins)
- [SDK Reference](https://opencode.ai/v2/docs/sdk)
- [Community Plugins](https://opencode.ai/v2/docs/ecosystem/#plugins)

## License

MIT
