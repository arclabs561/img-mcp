# img-mcp

An enhanced MCP (Model Context Protocol) server for AI image generation and editing. Backend-agnostic design supporting multiple providers (currently Gemini/Imagen).

## ✨ Features

- 🎨 **Generate Images**: Create new images from text prompts
- ✏️ **Edit Images**: Modify existing images with text instructions
- 🔄 **Continue Editing**: Iteratively improve the last generated/edited image
- 📚 **Resources**: Browse images via MCP resources (`img://image/{id}`)
- 📝 **Prompts**: Reusable prompt templates for common tasks
- 🔒 **Security**: Path validation, input sanitization, access control
- 🔁 **Resilience**: Retry logic with exponential backoff
- 📊 **Metadata**: Full image history and metadata tracking
- 🛠️ **Management**: List, search, delete, and get metadata for images
- ⚙️ **Configuration**: Model selection, format, quality settings
- 📋 **Logging**: Structured JSON logging to stderr

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
npm run build
```

### 2. Configure API Key

**Option A: Environment Variable (Recommended)**
```bash
# Add to .env file
GEMINI_API_KEY=your-api-key-here
```

Get your API key from: https://aistudio.google.com/app/apikey

**Option B: Via Tool**
Use the `configure_gemini_token` tool after starting the server.

### 3. Configure MCP Client

**Option A: From GitHub (Recommended for Distribution)**

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "https://raw.githubusercontent.com/YOUR_USERNAME/img-mcp/main/src/index.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `YOUR_USERNAME` with your GitHub username!

**Option B: Local Development**

For local use:

```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/absolute/path/to/img-mcp/src/index.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Option C: Published to npm**

If published to npm:

```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": ["-y", "img-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 4. Test

```bash
# Run integration test
npx tsx test-integration-complete.ts

# Or start server directly
npm start
```

## 📖 Available Tools

### Image Generation & Editing
- `generate_image` - Generate new images from text prompts
- `edit_image` - Edit existing images with optional reference images
- `continue_editing` - Continue editing the last image

### Image Management
- `list_images` - List all images with filtering
- `get_image_metadata` - Get detailed metadata for an image
- `delete_image` - Delete an image and its metadata
- `search_images` - Search images by prompt, date, type

### Configuration
- `configure_gemini_token` - Set up API key
- `configure_generation_settings` - Configure model, format, quality
- `get_configuration_status` - Check current configuration
- `get_last_image_info` - Get info about the last image

## 📚 Resources

The server exposes images as MCP resources:

- `img://gallery` - List all images
- `img://config` - View configuration (without sensitive data)
- `img://image/{id}` - Access specific images

## 📝 Prompts

Reusable prompt templates:

- `enhance_image` - Enhance image quality
- `style_transfer` - Transfer style between images
- `remove_background` - Remove image background
- `add_object` - Add objects to images
- `adjust_colors` - Adjust image colors

## 🔒 Security Features

- Path validation and sanitization
- Directory traversal protection
- Input validation and limits
- Whitelist-based access control
- Image format validation

## 📊 Metadata Tracking

All generated and edited images are tracked with:
- Unique ID and URI
- Original prompt
- Generation timestamp
- Model and format used
- File size and path
- Reference images (for edits)
- Parent image relationships

## 🛠️ Development

```bash
# Development mode
npm run dev

# Build
npm run build

# Test
npm test
npx tsx test-integration-complete.ts
```

## 📋 Implementation Details

This implementation includes all improvements from the gap analysis:

✅ Resources capability for browsing images
✅ Prompts capability for reusable templates
✅ Security fixes (path validation, input sanitization)
✅ Retry logic with exponential backoff
✅ Image metadata tracking and persistence
✅ Image management tools (list, search, delete)
✅ Configuration options (model, format, quality)
✅ Structured logging to stderr
✅ Better error handling and categorization
✅ Code organization and maintainability

See `ANALYSIS.md` for detailed gap analysis and `IMPLEMENTATION_SUMMARY.md` for implementation details.

## 📝 License

MIT
