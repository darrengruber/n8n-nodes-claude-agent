# Claude Agent for n8n

![n8n-nodes-claude-agent](https://img.shields.io/npm/v/n8n-nodes-claude-agent?color=orange&label=npm%20version)
![License](https://img.shields.io/npm/l/n8n-nodes-claude-agent?color=blue)
![Downloads](https://img.shields.io/npm/dt/n8n-nodes-claude-agent?color=green)

> [!IMPORTANT]
> **Disclaimer**: Claude, Claude Agent, and the Claude logo are trademarks of Anthropic, PBC. This project is an unofficial community integration and is not affiliated with, endorsed by, or sponsored by Anthropic or n8n.

This n8n node integrates the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) into your workflows, enabling powerful agentic AI capabilities with native tool support, memory management, and specific output parsing.

## ✨ Features

- **Official SDK Integration**: Built on top of the robust `@anthropic-ai/claude-agent-sdk`.
- **Dynamic Model Loading**: Automatically fetches available models from your Anthropic API.
- **Tool Support**:
    - **n8n Tools**: Connect standard n8n nodes as tools (Calculator, HTTP Request, etc.).
    - **Local MCP**: Connect to local Model Context Protocol (MCP) servers.
- **Memory Management**:
    - Connect n8n AI Memory nodes to maintain conversational context.
- **Output Parsing**:
    - Enforce specific JSON schemas using n8n Output Parser nodes.
- **Advanced Logging**:
    - Detailed file-based debug logging for troubleshooting.
    - Markdown-formatted execution logs.

## 🚀 Installation

To install this node in your n8n instance:

1.  Go to **Settings > Community Nodes**.
2.  Select **Install**.
3.  Enter `n8n-nodes-claude-agent`.
4.  Agree to the risks and install.

Alternatively, for self-hosted instances:

```bash
npm install n8n-nodes-claude-agent
```

## ⚙️ Configuration

This node requires **Anthropic API** credentials.

1.  Create a new credential in n8n.
2.  Search for **Anthropic API**.
3.  Enter your API Key.
4.  (Optional) Set a custom Base URL if using a compatible endpoint.

## 📖 Usage

### Basic Agent
1.  Add the **Claude Agent** node to your canvas.
2.  Connect your **Anthropic Chat Model**.
3.  Enter your prompt in the **Text** field.

### Using Tools
Connect standard n8n **AI Tool** nodes to the **Tools** input. The agent will automatically understand the tool's capabilities and call it when necessary.

### Using Local MCP Servers
1.  Add the **Local MCP Client** node (included in this package).
2.  Configure your local MCP server command (e.g., `npx -y @modelcontextprotocol/server-filesystem`).
3.  Connect it to the **Tools** input of the Claude Agent.

### Enforcing Output Format
1.  Add a **Structured Output Parser** node.
2.  Define your desired JSON schema.
3.  Connect it to the **Output Parser** input of the Claude Agent.
4.  The agent will be instructed to follow the format and the output will be automatically parsed.

## 🔍 Debugging

Detailed logs are written to the file system to help you debug agent behavior.

- **Default Location**: `~/claude-agent-logs/`
- **Custom Location**: Set `CLAUDE_AGENT_LOG_DIR` environment variable.

To watch logs in real-time:

```bash
ls -t ~/claude-agent-logs/debug-*.log | head -1 | xargs tail -f
```

See [LOGGING.md](./LOGGING.md) for more details.

## 🤝 Contributing

Contributions are welcome! Please see the [GitHub repository](https://github.com/darrengruber/n8n-nodes-claude-agent) for more information.

## 📄 License

[MIT](LICENSE.md)
