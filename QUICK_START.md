# Quick Start Guide

## For Users (Using from GitHub)

### 1. Add to Cursor Config

Add this to `~/.cursor/mcp.json`:

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

**Important**: Replace `YOUR_USERNAME` with the repository owner's GitHub username!

### 2. Get API Key

Get your Gemini API key from: https://aistudio.google.com/app/apikey

### 3. Restart Cursor

After adding the config, restart Cursor.

### 4. Use It!

Once restarted, you'll have access to:
- `generate_image` - Create images from text
- `edit_image` - Edit existing images
- `list_images` - Browse your images
- And more!

## For Developers (Local Setup)

### 1. Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/img-mcp.git
cd img-mcp
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure API Key

```bash
echo "GEMINI_API_KEY=your-api-key-here" > .env
```

### 4. Add to Cursor Config

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

### 5. Restart Cursor

That's it! No build step needed - `tsx` runs TypeScript directly.

