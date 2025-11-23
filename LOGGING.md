# Claude Agent - Debug Logging

## Log Location

Debug logs are written to timestamped files in the following locations (in priority order):

### 1. Custom Location (Recommended for Development)
Set the `CLAUDE_AGENT_LOG_DIR` environment variable to specify exactly where logs should be written:

```bash
export CLAUDE_AGENT_LOG_DIR="/Users/darren/repos/n8n-nodes-claude-agent/logs"
npm run dev
```

### 2. Home Directory (Default)
If no environment variable is set, logs are written to:
```
~/claude-agent-logs/
```

For example:
```
/Users/darren/claude-agent-logs/debug-2025-11-22T19-30-45.123Z.log
```

### 3. Working Directory (Fallback)
If `HOME` is not set, logs fall back to:
```
<current-working-directory>/logs/
```

## Log Format

Each log file contains:
- Timestamped entries for all operations
- Parameter details (prompt, model, options)
- Tool processing information
- SDK query configuration
- SDK message stream
- Errors with full stack traces

Example log entry:
```
[2025-11-22T18:46:51.071Z] === Claude Agent Debug Log ===
[2025-11-22T18:46:51.072Z] Started at: 2025-11-22T18:46:51.072Z
[2025-11-22T18:46:51.072Z] Log file: /Users/darren/claude-agent-logs/debug-2025-11-22T18-46-51.071Z.log
[2025-11-22T18:46:51.072Z] Log directory: /Users/darren/claude-agent-logs
```

## Viewing Logs

### Quick Access to Latest Log
```bash
# View the most recent log
ls -t ~/claude-agent-logs/debug-*.log | head -1 | xargs tail -f
```

### Search All Logs
```bash
# Search for errors
grep -r "ERROR" ~/claude-agent-logs/

# Search for specific tool calls
grep -r "Calculator" ~/claude-agent-logs/
```

### Clean Old Logs
```bash
# Remove logs older than 7 days
find ~/claude-agent-logs -name "debug-*.log" -mtime +7 -delete
```

## Enabling/Disabling Logging

Logging is currently **always enabled** in the code for debugging purposes. To disable it, modify the ClaudeAgent.node.ts file:

```typescript
// Change this line:
const logger = new DebugLogger(true); // Always enable for debugging

// To this:
const logger = new DebugLogger(options.verbose ?? false); // Only when verbose is enabled
```

## Current Log Location (During n8n-node dev)

When running `npm run dev`, if you haven't set the environment variable, logs will be in:
```
~/claude-agent-logs/
```

To see where logs are being written, check the console output when the node executes:
```
[ClaudeAgent] Logger created, log path: /Users/darren/claude-agent-logs/debug-TIMESTAMP.log
```
