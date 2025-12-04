# GitHub Distribution Setup

## How Others Can Use img-mcp from GitHub

Once you push this repo to GitHub, others can use it directly without cloning or building!

## Cursor Config for GitHub Distribution

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

**Replace `YOUR_USERNAME` with your GitHub username!**

## Alternative: Using GitHub Package URL

If you prefer the GitHub package format:

```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "-p",
        "tsx@latest",
        "https://raw.githubusercontent.com/YOUR_USERNAME/img-mcp/main/src/index.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Steps to Publish

1. **Create GitHub Repository**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: img-mcp server"
   git remote add origin https://github.com/YOUR_USERNAME/img-mcp.git
   git push -u origin main
   ```

2. **Update Cursor Config**:
   - Replace `YOUR_USERNAME` in the config above
   - Use the correct branch name (main/master)

3. **Share the Config**:
   - Others can copy the config
   - They just need to add their own `GEMINI_API_KEY`

## Benefits

- ✅ No npm publishing needed
- ✅ No local cloning required
- ✅ Always uses latest code from GitHub
- ✅ Easy to share and update
- ✅ Works with `npx` automatically

## Requirements

- Repository must be public (or users need access)
- `tsx` will be automatically downloaded by `npx`
- Users need Node.js 18+ installed

## For Your Local Development

You can still use the local path:

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
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Testing GitHub URL

Once pushed, test the GitHub URL works:

```bash
npx -y tsx https://raw.githubusercontent.com/YOUR_USERNAME/img-mcp/main/src/index.ts
```

If it runs without errors, the GitHub setup is working!

