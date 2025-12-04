# img-mcp

MCP server for AI image generation and editing. Backend-agnostic design supporting multiple providers.

## Quick Start from GitHub

Add to your `~/.cursor/mcp.json`:

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

**Replace `YOUR_USERNAME` with the repository owner's username!**

## Features

- 🎨 Generate images from text prompts
- ✏️ Edit existing images
- 🔄 Iterative editing workflows
- 📚 MCP Resources for browsing images
- 📝 Reusable prompt templates
- 🔒 Security features
- 📊 Image metadata tracking

## Get API Key

Get your Gemini API key from: https://aistudio.google.com/app/apikey

## Documentation

See the main [README.md](../README.md) for full documentation.

