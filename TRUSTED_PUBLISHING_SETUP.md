# Trusted Publishing Setup (OIDC)

This guide explains how to set up npm trusted publishing using OpenID Connect (OIDC) for secure, token-free publishing from GitHub Actions.

## Benefits

- ✅ **No long-lived tokens**: Uses short-lived OIDC tokens from GitHub
- ✅ **Workflow-scoped**: Only works from specific GitHub repo + workflow
- ✅ **Automatic provenance**: npm automatically attaches provenance attestations
- ✅ **More secure**: Tokens can't be exfiltrated and reused

## Prerequisites

- npm CLI 11.5.1 or later (automatically installed in workflow)
- Package must exist on npmjs.com
- GitHub Actions workflow file (`.github/workflows/publish.yml`)

## Setup Steps

### 1. Configure Trusted Publisher on npm

1. Go to your package on npmjs.com: https://www.npmjs.com/package/img-mcp
2. Click **Settings** → **Trusted publishing** (or **Trusted publishers**)
3. Click **Add trusted publisher**
4. Fill in:
   - **Publisher**: Select "GitHub Actions"
   - **GitHub owner**: `arclabs561`
   - **Repository**: `img-mcp`
   - **Workflow filename**: `.github/workflows/publish.yml`
   - **Environment** (optional): Leave empty unless using GitHub Environments
5. Click **Add trusted publisher**

### 2. Verify Workflow Configuration

The workflow (`.github/workflows/publish.yml`) must have:

```yaml
permissions:
  id-token: write  # Required for OIDC
  contents: read
```

And use `npm publish` without any `NODE_AUTH_TOKEN`.

### 3. Test Trusted Publishing

**Option A: Manual Trigger**
1. Go to Actions → Publish to npm
2. Click "Run workflow"
3. Select version bump type (or leave default)
4. Click "Run workflow"

**Option B: Release Trigger**
1. Create a new GitHub Release
2. Workflow will automatically run and publish

**Option C: Version Bump Script**
```bash
# Bump version
npm version patch  # or minor, major

# Push tags
git push origin main --follow-tags

# Create release (triggers publish workflow)
gh release create v$(node -p "require('./package.json').version")
```

## How It Works

1. GitHub Actions workflow runs
2. GitHub issues a short-lived OIDC token
3. npm CLI detects OIDC environment
4. npm exchanges OIDC token for short-lived npm token
5. Package is published with provenance attestation
6. Token expires immediately after use

## Troubleshooting

### "Trusted publishing failed"

- Verify workflow filename matches exactly: `.github/workflows/publish.yml`
- Check that `permissions.id-token: write` is set
- Ensure npm version is 11.5.1+ (workflow installs latest)
- Verify trusted publisher is configured on npm package settings

### "No OIDC token available"

- Check that `permissions.id-token: write` is in the workflow
- Ensure you're using GitHub-hosted runners (not self-hosted)

### "Publisher not trusted"

- Double-check the trusted publisher configuration on npm
- Verify owner, repo, and workflow filename match exactly
- Check that the package exists and you have admin access

## Security Notes

- Trusted publishing only works from the configured GitHub repo + workflow
- OIDC tokens are short-lived and workflow-scoped
- No secrets need to be stored in GitHub
- Provenance attestations are automatically attached

## Migration from Token-Based Publishing

If you're currently using `NODE_AUTH_TOKEN`:

1. Set up trusted publishing (steps above)
2. Test that it works
3. Remove `NODE_AUTH_TOKEN` from GitHub Secrets
4. Update workflow to remove `NODE_AUTH_TOKEN` env var
5. Optionally set package to "Require two-factor authentication and disallow tokens"

## References

- [npm Trusted Publishers Docs](https://docs.npmjs.com/trusted-publishers/)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Blog: Trusted Publishing](https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/)

