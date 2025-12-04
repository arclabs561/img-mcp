# Adding img-mcp to Cursor MCP Configuration

## Quick Setup

### Option 1: From GitHub (Recommended for Distribution) ⭐

Add this to your `~/.cursor/mcp.json`:

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

**Replace `YOUR_USERNAME` with the GitHub repository owner's username!**

**Pros**: 
- ✅ No build step needed
- ✅ No local cloning required
- ✅ Always uses latest code
- ✅ Easy to share

### Option 2: Local Development

For local use:

```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/Users/arc/Documents/dev/img-mcp/src/index.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A"
      }
    }
  }
}
```

**Pros**: No build step needed, runs directly from TypeScript source

### Option 2: Use Built Version (If You Have dist/)

If you've already built the project (`npm run build`), you can use:

```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "node",
      "args": [
        "/Users/arc/Documents/dev/img-mcp/dist/index.js"
      ],
      "env": {
        "GEMINI_API_KEY": "AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A"
      }
    }
  }
}
```

### Option 3: Publish to npm (For Distribution)

If you publish to npm, others can use:

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

## Step-by-Step Instructions

### 1. Add to Existing Config

1. Open `~/.cursor/mcp.json` in your editor
2. Find the `"mcpServers"` object
3. Add the `"img-mcp"` entry inside it
4. Use **Option 1** (tsx from source) - no build needed!
5. Save the file
6. Restart Cursor

### 2. Complete Config Example

Here's how your complete `~/.cursor/mcp.json` should look:

```json
{
  "mcpServers": {
    "firecrawl-mcp": { ... },
    "tavily-remote-mcp": { ... },
    "context7": { ... },
    "perplexity": { ... },
    "arxiv-semantic-search-mcp": { ... },
    "github": { ... },
    "ast-grep": { ... },
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "tsx",
        "/Users/arc/Documents/dev/img-mcp/src/index.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A"
      }
    }
  }
}
```

## Important Notes

### 1. Use Absolute Path
Make sure to use the **absolute path** to `src/index.ts`:
```json
"args": ["-y", "tsx", "/Users/arc/Documents/dev/img-mcp/src/index.ts"]
```

### 2. No Build Required
Using `tsx` means no build step needed - it compiles TypeScript on the fly!

### 3. API Key
The API key is already in your `.env` file, but you can also:
- Keep it in the `env` section (as shown above)
- Or remove it from `env` and let it load from `.env` file
- Or use the `configure_gemini_token` tool after starting

### 4. Restart Cursor
After adding the config, **restart Cursor** for the changes to take effect.

## Alternative: Load API Key from .env

If you prefer to keep the API key in the `.env` file (more secure), you can omit it from the config:

```json
"img-mcp": {
  "command": "npx",
  "args": [
    "-y",
    "tsx",
    "/Users/arc/Documents/dev/img-mcp/src/index.ts"
  ],
  "env": {}
}
```

The server will automatically load `GEMINI_API_KEY` from the `.env` file in the project directory.

## Verification

After restarting Cursor, you should see:
1. The img-mcp server in your MCP servers list
2. Available tools when you use MCP features
3. No errors in the Cursor logs

## Available Tools

Once configured, you'll have access to:
- `generate_image` - Generate new images
- `edit_image` - Edit existing images
- `continue_editing` - Continue editing last image
- `list_images` - List all images
- `get_image_metadata` - Get image details
- `delete_image` - Delete images
- `search_images` - Search images
- `configure_gemini_token` - Configure API key
- `configure_generation_settings` - Configure model/format
- `get_configuration_status` - Check config
- `get_last_image_info` - Get last image info

## Resources

You'll also have access to MCP resources:
- `img://gallery` - Browse all images
- `img://config` - View configuration
- `img://image/{id}` - Access specific images

## Prompts

And prompt templates:
- `enhance_image` - Enhance image quality
- `style_transfer` - Transfer style
- `remove_background` - Remove background
- `add_object` - Add objects
- `adjust_colors` - Adjust colors

## Troubleshooting

### Server Not Starting
- Check that `src/index.ts` exists
- Verify the path is correct and absolute
- Check Cursor logs for errors
- Make sure `tsx` is available (it's now a dependency)

### API Key Issues
- Verify the API key is correct
- Check that it's in the `env` section or `.env` file
- Try using `configure_gemini_token` tool

### Tools Not Appearing
- Restart Cursor after adding config
- Check MCP server status in Cursor
- Verify the server is running (check logs)
