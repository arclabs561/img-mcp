# Publishing img-mcp to GitHub

## Quick Steps

### 1. Initialize Git (if not already done)

```bash
cd /Users/arc/Documents/dev/img-mcp
git init
git add .
git commit -m "Initial commit: img-mcp server"
```

### 2. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `img-mcp`
3. Description: "MCP server for AI image generation and editing"
4. Set to **Public** (so others can use it)
5. Don't initialize with README (we already have one)
6. Click "Create repository"

### 3. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/img-mcp.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username!

### 4. Update Cursor Config

Once pushed, update your `~/.cursor/mcp.json`:

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

**Replace `YOUR_USERNAME` with your actual GitHub username!**

### 5. Share with Others

Others can use the same config - they just need to:
1. Replace `YOUR_USERNAME` with your GitHub username
2. Add their own `GEMINI_API_KEY`

## Testing

After pushing, test that the GitHub URL works:

```bash
npx -y tsx https://raw.githubusercontent.com/YOUR_USERNAME/img-mcp/main/src/index.ts
```

If it starts without errors, it's working!

## Files Included

The `.gitignore` is configured to exclude:
- `node_modules/` - Dependencies (installed via npm)
- `dist/` - Build output (not needed, runs from source)
- `.env` - API keys (users add their own)
- `test_output/` - Test images
- Generated images

## What Gets Published

- ✅ `src/` - Source code (TypeScript)
- ✅ `package.json` - Dependencies and scripts
- ✅ `tsconfig.json` - TypeScript config
- ✅ `README.md` - Documentation
- ✅ `.gitignore` - Git ignore rules
- ✅ All documentation files

## Benefits

- ✅ Others can use it without cloning
- ✅ No build step needed (runs from source with tsx)
- ✅ Always uses latest code
- ✅ Easy to share and update
- ✅ Works with `npx` automatically

