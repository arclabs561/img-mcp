# Setup Instructions

## Quick Start

### 1. Add Gemini API Key

**Option A: Manual (Recommended)**
```bash
# Edit .env file
GEMINI_API_KEY=your-actual-api-key-here
```

**Option B: Interactive Script**
```bash
./add-api-key.sh
```

**Option C: From Command Line**
```bash
echo "GEMINI_API_KEY=your-actual-api-key-here" > .env
```

Get your API key from: https://aistudio.google.com/app/apikey

### 2. Build the Project

```bash
npm install
npm run build
```

### 3. Test the Server

```bash
# Run integration test
npx tsx test-integration-complete.ts

# Or start the server directly
npm start
```

### 4. Configure MCP Client

Add to `~/.cursor/mcp.json`:

```json
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
```

## Testing the Implementation

Once the API key is configured, you can test:

1. **Configuration**:
   - `get_configuration_status` - Verify API key is loaded

2. **Image Generation**:
   - `generate_image` with prompt: "A beautiful sunset over mountains"
   - Check that image is saved and metadata is tracked

3. **Resources**:
   - List resources: `nano-banana://gallery`
   - Read image resource: `nano-banana://image/{id}`

4. **Prompts**:
   - List prompts
   - Get prompt: `enhance_image` with arguments

5. **Image Management**:
   - `list_images` - See all generated images
   - `get_image_metadata` - Get details about an image
   - `search_images` - Search by prompt text

6. **Image Editing**:
   - `edit_image` - Edit an existing image
   - `continue_editing` - Iteratively improve images

## Features Implemented

✅ **Resources Capability** - Browse images via MCP resources
✅ **Prompts Capability** - Reusable prompt templates
✅ **Security** - Path validation, input sanitization
✅ **Error Handling** - Retry logic with exponential backoff
✅ **Metadata Tracking** - Full image history and metadata
✅ **Image Management** - List, search, delete, get metadata
✅ **Configuration** - Model selection, format, quality settings
✅ **Structured Logging** - JSON logs to stderr
✅ **Code Organization** - Clean, maintainable structure

## Troubleshooting

**API Key Issues**:
- Verify key is correct and active
- Check .env file is in project root
- Ensure no extra spaces in .env file

**Build Issues**:
- Run `npm install` to ensure dependencies are installed
- Check Node.js version (requires >= 18.0.0)

**Server Not Starting**:
- Check logs in stderr
- Verify MCP client configuration
- Test with: `node dist/index.js` directly

