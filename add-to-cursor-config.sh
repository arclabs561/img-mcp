#!/bin/bash
# Helper script to add img-mcp to Cursor config

CONFIG_FILE="$HOME/.cursor/mcp.json"
PROJECT_DIR="/Users/arc/Documents/dev/img-mcp"

echo "🔧 Adding img-mcp to Cursor MCP configuration..."
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
  echo "⚠️  Config file not found. Creating new one..."
  mkdir -p "$(dirname "$CONFIG_FILE")"
  cat > "$CONFIG_FILE" << 'EOFCONFIG'
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "https://raw.githubusercontent.com/arclabs561/img-mcp/master/src/index.ts"
      ],
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
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "https://raw.githubusercontent.com/arclabs561/img-mcp/master/src/index.ts"
      ],
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
echo "   1. Replace 'your-api-key-here' with your actual Gemini API key"
echo "   2. Verify the config entry was added"
echo "   3. Restart Cursor"
echo "   4. Check MCP servers in Cursor settings"
