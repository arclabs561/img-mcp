# Distribution Options for img-mcp

## Problem
Users won't have the `dist/` directory locally. We need distribution methods that work for everyone.

## Solutions

### Option 1: Publish to npm (Recommended for Public Use) ⭐

**Best for**: Public distribution, easy installation

**Setup**:
1. Publish to npm: `npm publish`
2. Users install via: `npx img-mcp` or `npm install -g img-mcp`

**Cursor Config**:
```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": ["-y", "img-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Pros**:
- ✅ Works like your other MCP servers (firecrawl, perplexity, etc.)
- ✅ No local build needed
- ✅ Automatic updates via npm
- ✅ Standard distribution method

**Cons**:
- ⚠️ Requires npm account and publishing
- ⚠️ Need to maintain versioning

### Option 2: Run from Source with tsx (Best for Development/Local)

**Best for**: Local development, GitHub repos

**Setup**:
- Add `tsx` as a dependency (not just devDependency)
- Run directly from source

**Cursor Config**:
```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": ["-y", "tsx", "/absolute/path/to/img-mcp/src/index.ts"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Or from GitHub**:
```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": ["-y", "tsx", "https://raw.githubusercontent.com/user/img-mcp/main/src/index.ts"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Pros**:
- ✅ No build step needed
- ✅ Works from GitHub
- ✅ Always latest code

**Cons**:
- ⚠️ Requires tsx to be available
- ⚠️ Slightly slower startup (compiles on the fly)

### Option 3: Auto-build on Install (Current Setup)

**Best for**: npm packages with build step

**Setup**:
- `prepare` script runs `npm run build` automatically
- Users install: `npm install img-mcp`
- Build happens automatically

**Cursor Config**:
```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "node",
      "args": ["/path/to/node_modules/img-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Pros**:
- ✅ Build happens automatically
- ✅ Faster runtime (pre-compiled)

**Cons**:
- ⚠️ Requires npm install first
- ⚠️ Path depends on node_modules location

### Option 4: GitHub + npx (Best for Open Source)

**Best for**: GitHub repos, open source projects

**Setup**:
- Push to GitHub
- Use `npx` with GitHub URL

**Cursor Config**:
```json
{
  "mcpServers": {
    "img-mcp": {
      "command": "npx",
      "args": ["-y", "-p", "tsx", "github:username/img-mcp/src/index.ts"],
      "env": {
        "GEMINI_API_KEY": "your-api-key"
      }
    }
  }
}
```

**Pros**:
- ✅ Works directly from GitHub
- ✅ No npm publishing needed
- ✅ Easy to share

**Cons**:
- ⚠️ Requires tsx
- ⚠️ GitHub URL format can be tricky

## Recommended Approach

### For You (Local Development):
Use Option 2 (tsx from source) - already set up with `npm run dev`

### For Others (Distribution):
**Best**: Option 1 (npm publish) - matches your other MCP servers
**Alternative**: Option 2 (tsx from GitHub) - if you don't want to publish to npm

## Quick Fix for Current Setup

To make it work immediately without publishing, update Cursor config to use tsx:

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

This runs directly from source - no build needed!

