# Backend-Agnostic Naming Research

## Goal
Find a name that:
- ✅ Doesn't reference specific providers (Gemini, OpenAI, etc.)
- ✅ Focuses on functionality (image generation + editing)
- ✅ Follows MCP naming conventions (camelCase)
- ✅ Professional and clear
- ✅ Future-proof for multi-provider support

## Current Server Capabilities

The server provides:
- Image generation from text prompts
- Image editing with text instructions
- Iterative editing workflows
- Reference image support
- Image management (list, search, delete, metadata)
- Multiple model support (currently Gemini/Imagen, but extensible)

## Backend-Agnostic Name Options

### Option 1: `imageStudioMcp` ⭐ (Top Choice)
**Pros**:
- ✅ Professional and feature-focused
- ✅ Implies both generation and editing ("studio")
- ✅ No provider reference
- ✅ Easy to understand
- ✅ Follows camelCase convention

**Cons**:
- ⚠️ "Studio" might imply it's only for editing

### Option 2: `imageForgeMcp`
**Pros**:
- ✅ Creative and memorable
- ✅ "Forge" implies creation and modification
- ✅ No provider reference
- ✅ Unique name

**Cons**:
- ⚠️ Less immediately clear what it does
- ⚠️ "Forge" might be too abstract

### Option 3: `visualStudioMcp`
**Pros**:
- ✅ Professional
- ✅ Clear visual focus
- ✅ No provider reference

**Cons**:
- ⚠️ Might conflict with Microsoft Visual Studio
- ⚠️ "Studio" still might imply editing-only

### Option 4: `imageGenMcp`
**Pros**:
- ✅ Short and clear
- ✅ Directly describes generation
- ✅ No provider reference
- ✅ Similar to existing `image-gen-mcp` (44 stars)

**Cons**:
- ⚠️ Doesn't emphasize editing capability
- ⚠️ Might be too generic

### Option 5: `imageWorkshopMcp`
**Pros**:
- ✅ Implies both creation and modification
- ✅ Professional
- ✅ No provider reference

**Cons**:
- ⚠️ Slightly longer
- ⚠️ "Workshop" might be less familiar

### Option 6: `aiImageMcp`
**Pros**:
- ✅ Short and clear
- ✅ Indicates AI-powered
- ✅ No specific provider

**Cons**:
- ⚠️ Very generic
- ⚠️ Doesn't emphasize editing

### Option 7: `imageCraftMcp`
**Pros**:
- ✅ Creative and memorable
- ✅ "Craft" implies skill and creation
- ✅ No provider reference

**Cons**:
- ⚠️ Less immediately clear
- ⚠️ Might be too abstract

### Option 8: `visualForgeMcp`
**Pros**:
- ✅ Combines visual + creation concept
- ✅ No provider reference
- ✅ Unique

**Cons**:
- ⚠️ "Forge" might be too abstract

### Option 9: `imageLabMcp`
**Pros**:
- ✅ Implies experimentation and creation
- ✅ Short and clear
- ✅ No provider reference

**Cons**:
- ⚠️ "Lab" might imply it's experimental/unstable

### Option 10: `imageFactoryMcp`
**Pros**:
- ✅ Clear creation focus
- ✅ Professional
- ✅ No provider reference

**Cons**:
- ⚠️ "Factory" might sound too industrial
- ⚠️ Doesn't emphasize editing

## Comparison Matrix

| Name | Clear | Professional | Memorable | Editing Implied | Length |
|------|-------|--------------|-----------|-----------------|--------|
| `imageStudioMcp` | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Good |
| `imageForgeMcp` | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Good |
| `visualStudioMcp` | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | Good |
| `imageGenMcp` | ⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | Excellent |
| `imageWorkshopMcp` | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | Good |
| `aiImageMcp` | ⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐ | Excellent |
| `imageCraftMcp` | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Good |
| `visualForgeMcp` | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ | Good |
| `imageLabMcp` | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐ | Good |
| `imageFactoryMcp` | ⭐⭐ | ⭐⭐ | ⭐ | ⭐ | Good |

## Final Recommendations

### Primary: `imageStudioMcp` ⭐
**Best overall balance**:
- Professional and clear
- Implies both generation and editing
- No provider lock-in
- Easy to understand
- Follows conventions

### Alternative: `imageGenMcp`
**If you want simplicity**:
- Short and direct
- Similar to popular `image-gen-mcp`
- Clear generation focus
- Less emphasis on editing

### Alternative: `imageWorkshopMcp`
**If you want to emphasize both capabilities**:
- Clearly implies both creation and modification
- Professional
- Slightly longer but more descriptive

## Resource URI Options

Current: `nano-banana://image/{id}`

Backend-agnostic options:
- `image-studio://image/{id}` - Matches new name
- `image://image/{id}` - Simple but might conflict
- `visual://image/{id}` - Shorter alternative
- `img://image/{id}` - Very short

**Recommendation**: `image-studio://image/{id}` for consistency

## Implementation Notes

If renaming to be backend-agnostic:
1. Update all references to remove "Gemini" branding
2. Make model/provider selection more generic
3. Update documentation to emphasize multi-provider support
4. Keep API key naming generic (`IMAGE_API_KEY` or keep `GEMINI_API_KEY` for now)
5. Update resource URIs to match new name

