# MCP Server Naming Research

## Current Name Analysis

**Current**: `nano-banana-mcp`
- ✅ Memorable and unique
- ❌ Not descriptive of functionality
- ❌ References an informal nickname, not official branding
- ❌ Doesn't follow camelCase convention
- ❌ May confuse users unfamiliar with the nickname

## MCP Naming Conventions

Based on research, MCP servers should:
1. Use **camelCase** formatting (e.g., "uiTesting", "githubIntegration")
2. Be **descriptive** of functionality or brand
3. Follow **consistent patterns** across servers
4. Avoid special characters and whitespace

## Existing Similar Servers

| Name | Stars | Description | Notes |
|------|-------|-------------|-------|
| `image-gen-mcp` | 44 | Text-to-image generation | Simple, clear |
| `mcp-server-gemini-image-generator` | 24 | Gemini image generation | Very descriptive |
| `mcp-image` | 23 | Gemini 3 Pro Image (Nano Banana) | Short, uses nickname |
| `gemini-image-mcp-server` | 2 | Gemini image generation | Brand + function |
| `image-gen-mcp-server` | 4 | Multi-provider image gen | Generic but clear |
| `mcp-server-nano-banana` | 5 | Nano banana image gen | Uses nickname |

## Our Server's Unique Features

What makes this server different:
- ✅ **Image generation AND editing** (not just generation)
- ✅ **Multiple models** (Gemini 2.5 Flash, 3 Pro, Imagen 4.0)
- ✅ **Full MCP capabilities** (Tools, Resources, Prompts)
- ✅ **Image management** (list, search, delete, metadata)
- ✅ **Reference images** support
- ✅ **Iterative editing** workflows

## Recommended Name Options

### Option 1: `geminiImageMcp` ⭐ (Recommended)
**Pros**:
- ✅ Follows camelCase convention
- ✅ Clear brand association (Gemini)
- ✅ Descriptive (image generation/editing)
- ✅ Professional and searchable
- ✅ Aligns with existing patterns

**Cons**:
- ⚠️ Doesn't explicitly mention editing (but "image" covers both)

### Option 2: `geminiImagenMcp`
**Pros**:
- ✅ Covers both Gemini and Imagen models
- ✅ Technically accurate
- ✅ Follows conventions

**Cons**:
- ⚠️ "Imagen" might confuse non-technical users
- ⚠️ Longer name

### Option 3: `imageStudioMcp`
**Pros**:
- ✅ Professional and feature-focused
- ✅ Implies both generation and editing
- ✅ Brand-agnostic (works if we add other providers)

**Cons**:
- ⚠️ Doesn't indicate it's Gemini-powered
- ⚠️ Less searchable for "gemini" queries

### Option 4: `geminiImageEditorMcp`
**Pros**:
- ✅ Very descriptive
- ✅ Explicitly mentions editing capability
- ✅ Clear brand association

**Cons**:
- ⚠️ Longer name
- ⚠️ "Editor" might imply it's only for editing

### Option 5: `aiImageMcp`
**Pros**:
- ✅ Short and clear
- ✅ Generic enough for future expansion

**Cons**:
- ⚠️ Too generic, doesn't indicate Gemini
- ⚠️ Less searchable

## Final Recommendation

### Primary Choice: `geminiImageMcp`

**Reasoning**:
1. **Follows conventions**: camelCase format
2. **Clear and descriptive**: Immediately tells you it's Gemini-powered image generation
3. **Professional**: No informal nicknames
4. **Searchable**: Users searching for "gemini image mcp" will find it
5. **Concise**: Not too long, easy to type
6. **Aligned with patterns**: Similar to `gemini-image-mcp-server` but shorter

### Alternative: `geminiImagenMcp`

If you want to emphasize support for both Gemini and Imagen models, this is a good alternative.

## Migration Considerations

If renaming, need to update:
- `package.json` - name field
- `src/index.ts` - server name
- All documentation
- Config examples
- Resource URIs (could keep `nano-banana://` for backward compatibility or change to `gemini-image://`)

## Resource URI Options

Current: `nano-banana://image/{id}`

Options:
- `gemini-image://image/{id}` - Matches new name
- `gemini://image/{id}` - Shorter
- Keep `nano-banana://` - Backward compatibility, but inconsistent with new name

**Recommendation**: `gemini-image://image/{id}` for consistency

