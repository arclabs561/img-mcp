#!/bin/bash
# Helper script to add img-mcp to Cursor config

CONFIG_FILE="$HOME/.cursor/mcp.json"
PROJECT_DIR="/Users/arc/Documents/dev/img-mcp"
BUILD_FILE="$PROJECT_DIR/dist/index.js"

echo "🔧 Adding nano-banana-mcp to Cursor MCP configuration..."
echo ""

# Check if build exists
if [ ! -f "$BUILD_FILE" ]; then
  echo "⚠️  Build file not found. Building project..."
  cd "$PROJECT_DIR"
  npm run build
  if [ ! -f "$BUILD_FILE" ]; then
    echo "❌ Build failed. Please run 'npm run build' manually."
    exit 1
  fi
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "⚠️  Config file not found. Creating new one..."
  mkdir -p "$(dirname "$CONFIG_FILE")"
  cat > "$CONFIG_FILE" << 'EOFCONFIG'
{
  "mcpServers": {
    "nano-banana-mcp": {
      "command": "node",
      "args": ["/Users/arc/Documents/dev/img-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
EOFCONFIG
  echo "✅ Created new config file"
else
  echo "📝 Config file exists. Please add manually:"
  echo ""
  echo "Add this entry to the 'mcpServers' object:"
  echo ""
  cat << 'EOFCONFIG'
    "nano-banana-mcp": {
      "command": "node",
      "args": ["/Users/arc/Documents/dev/img-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
EOFCONFIG
  echo ""
  echo "Or edit the file manually: $CONFIG_FILE"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify the config entry was added"
echo "   2. Restart Cursor"
echo "   3. Check MCP servers in Cursor settings"
