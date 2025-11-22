#!/bin/bash

# Set log directory to project root /logs
export CLAUDE_AGENT_LOG_DIR="$(pwd)/logs"

echo "📝 Debug logs will be written to: $CLAUDE_AGENT_LOG_DIR"
echo "Starting n8n dev server..."

# Run npm dev
npm run dev
