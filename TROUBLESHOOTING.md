# Known Issues

## Claude Code SDK Process Exit Error

### Symptom
The node fails with error: `Claude Code process exited with code 1`

### Potential Causes

1. **Custom Base URL Compatibility**: The Claude Code SDK spawns a subprocess that might not fully respect `ANTHROPIC_BASE_URL` for all operations. If you're using a custom endpoint (e.g., `https://api.z.ai/api/anthropic`), the subprocess might fail to authenticate or connect.

2. **Tool Server Issues**: If you have tools connected, the MCP server creation might be causing the subprocess to fail. Try running without tools to isolate the issue.

3. **Model Name Mismatch**: Ensure the model name is valid for your endpoint. Custom endpoints might have different model names than the standard Anthropic API.

### Debugging Steps

1. **Enable Verbose Mode**: In the node options, enable "Verbose" to see detailed logs in the n8n console.

2. **Check n8n Logs**: The detailed error logs will be printed to the n8n console with the `[ClaudeCodeAgent]` prefix.

3. **Test Without Tools**: Disconnect any tool inputs to see if the issue is related to MCP tool server creation.

4. **Verify Endpoint**: If using a custom base URL, verify it's compatible with the Claude Code SDK's subprocess requirements.

5. **Try Standard Endpoint**: Temporarily test with the standard Anthropic API endpoint to confirm the issue is related to the custom endpoint.

### Workarounds

- Use the standard Anthropic API endpoint (`https://api.anthropic.com`) if possible
- If using a proxy, ensure it fully supports the Claude API including streaming and subprocess operations
- Consider using a different node type if Claude Code SDK is incompatible with your setup
