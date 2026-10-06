import { Plugin } from '@opencode/plugin'
import { Schema } from 'effect'

/**
 * {{PLUGIN_NAME}} - OpenCode Plugin (V2)
 *
 * Documentation: https://opencode.ai/v2/docs/build/plugins
 * SDK Reference: https://opencode.ai/v2/docs/sdk
 *
 * V2 Plugin API: Plugins use `Plugin.define({ id, setup(ctx) })` pattern.
 * The `setup` function receives a Context with domain services and registers
 * hooks/tools programmatically before returning an optional cleanup function.
 */
export default Plugin.define({
	id: '{{PACKAGE_NAME}}',
	setup(ctx) {
		// ctx provides domain services:
		// - app: { name, version, channel } — server info (no logging method)
		// - location: { directory, project: { id, directory, canonical } }
		//   Replaces V1's `ctx.directory` and `ctx.project`
		// - options: Readonly<Record<string, any>> — plugin options from config
		//   Replaces V1's `ctx.client.config.get()`
		// - storage: { get, set, remove, scan } — persisted key-value state
		// - tool: ToolDomain — transform (add/remove tools), list, hook
		// - session: SessionDomain — hook for session lifecycle events
		// - event: EventDomain — subscribe to OpenCode events
		// - permission: PermissionDomain — hook('evaluate') for permission control
		// - shell: ShellDomain — hook('create.before') for shell command control
		// - command: CommandDomain — transform (add/remove commands)
		// - provider: ProviderDomain — manage AI providers
		// - model: ModelDomain — manage models
		// - agent: AgentDomain — manage agents
		// - mcp: MCPDomain — manage MCP servers
		// - vcs: VcsDomain — VCS integration
		// - skill: SkillDomain — manage skills
		// - reference: ReferenceDomain — manage references
		// - worktree: WorktreeDomain — manage worktrees
		// - websearch: WebSearchDomain — web search
		// - integration: IntegrationDomain — OAuth/API integrations
		// - rpc: RpcDomain — custom RPC methods
		// - generate: GenerateApi — text generation
		// - experimental: { terminal } — experimental terminal access
		// - plugin: { list } — list loaded plugins

		// Use console.log for logging (no ctx.client.app.log in V2)
		console.log('[{{PACKAGE_NAME}}] plugin initialized')

		// ============================================================
		// EVENT HOOKS
		// ============================================================

		// Subscribe to OpenCode events
		// Event types: session.idle, session.error, file.edited, tool.execute.after, etc.
		ctx.event.subscribe(({ event }) => {
			// event: { type, data, created, id, location?, metadata? }
		})

		// ============================================================
		// SESSION HOOKS (replaces V1 chat.* hooks)
		// ============================================================

		// Intercept/modify user prompts before processing
		// Replaces V1 'chat.message'
		ctx.session.hook('prompt', ({ sessionID, prompt, metadata }) => {
			// prompt.prompt: PromptInput.Prompt (mutable) — modify message content
			// prompt.metadata: Record<string, unknown> (mutable)
			// prompt.delivery: SessionInbox.Delivery
		})

		// Modify LLM context (system prompt, messages, options)
		// Replaces V1 'chat.params', 'chat.headers', 'chat.system.transform',
		// and 'experimental.chat.messages.transform'
		ctx.session.hook('context', ({ sessionID, agent, model, system, messages, options }) => {
			// system: SystemPart[] (mutable) — modify system prompt
			// messages: Message[] (mutable) — modify conversation
			// options: Record<string, unknown> (mutable) — modify LLM params (temperature, etc.)
		})

		// Customize session compaction (skip model request, add context)
		// Replaces V1 'experimental.session.compacting'
		ctx.session.hook('compaction', ({ sessionID, agent, model, system, messages, options, result }) => {
			// Set `result` to skip the model request and provide your own summary:
			// result = { summary: "...", providerState?: ..., metadata?: ... }
		})

		// Customize session title generation
		ctx.session.hook('title', ({ sessionID, agent, model, system, messages, options, result }) => {
			// Set `result` to provide a custom title and skip the model request
		})

		// Generate text from a custom prompt (bypasses the normal session flow)
		ctx.session.hook('generate', ({ sessionID, agent, model, system, messages, options }) => {
			// Modify system, messages, or options for generation requests
		})

		// Intercept/modify HTTP requests to model providers
		// Replaces V1's 'chat.headers' (partial)
		ctx.session.hook('model.request', ({ sessionID, agent, model, kind, baseURL, headers }) => {
			// baseURL: string (mutable) — change the API endpoint
			// headers: Record<string, string> (mutable) — add/modify headers
		})

		ctx.session.hook('http.request', ({ sessionID, agent, model, kind, request }) => {
			// request: Request (mutable) — modify the outgoing HTTP request
		})

		ctx.session.hook('http.response', ({ sessionID, agent, model, kind, request, response }) => {
			// response: Response (mutable) — modify the HTTP response
		})

		// Handle retries when model requests fail
		ctx.session.hook('retry', ({ sessionID, agent, model, error, attempt, decision }) => {
			// decision: { retry: false } | { retry: true, delay: number }
		})

		// ============================================================
		// TOOL HOOKS
		// ============================================================

		// Called before a tool executes (throw to block execution)
		ctx.tool.hook('execute.before', ({ tool, sessionID, agent, messageID, id, input }) => {
			// Block dangerous operations:
			// if (tool === 'read' && String(input).includes('.env')) {
			//   throw new Error('Cannot read .env files')
			// }
		})

		// Called after a tool executes
		ctx.tool.hook('execute.after', ({ tool, sessionID, agent, messageID, id, input, status, result, error }) => {
			// status: 'completed' | 'error'
			// result: Tool.Result (if completed)
			// error: Tool.Error (if errored)
		})

		// ============================================================
		// PERMISSION HOOKS (replaces V1 'permission.ask')
		// ============================================================

		ctx.permission.hook('evaluate', ({ sessionID, agent, action, resources, effect, message }) => {
			// Auto-allow/deny certain permissions:
			// if (action === 'shell' && resources.every(r => r.startsWith('ls'))) {
			//   effect = 'allow'
			// }
		})

		// ============================================================
		// SHELL HOOKS (replaces V1 'shell.env')
		// ============================================================

		ctx.shell.hook('create.before', ({ command, cwd, timeout, shell, env }) => {
			// Inject environment variables:
			// env.MY_API_KEY = process.env.MY_API_KEY || ''
		})

		// ============================================================
		// CUSTOM TOOLS (replaces V1's `tool` return object)
		// ============================================================

		// Tools are defined using Effect's Schema for input/output.
		// Import { Schema } from 'effect' at the top of your file.
		//
		// Example:
		// ctx.tool.transform((editor) => {
		//   editor.add({
		//     name: 'mytool',
		//     description: 'What this tool does',
		//     input: Schema.Struct({ foo: Schema.String }),
		//     execute: ({ foo }) => {
		//       return Effect.succeed({
		//         content: [{ type: 'text' as const, text: `Result: ${foo}` }],
		//       })
		//     },
		//   })
		// })

		// ============================================================
		// CUSTOM COMMANDS
		// ============================================================

		// Commands are registered via the command transform:
		// ctx.command.transform((editor) => {
		//   editor.add({
		//     name: 'my-command',
		//     description: 'Description',
		//     execute: async ({ prompt }) => {
		//       // handle command
		//     },
		//   })
		// })

		// ============================================================
		// OPTIONAL CLEANUP
		// ============================================================

		// Return a cleanup function that runs when the plugin is unloaded:
		return async () => {
			console.log('[{{PACKAGE_NAME}}] plugin cleaned up')
		}
	},
})
