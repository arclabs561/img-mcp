# Security Policy

## 🔒 Secret Management

**IMPORTANT**: Never commit API keys, tokens, or secrets to the repository!

### ✅ Safe Practices

- Use environment variables (`.env` file - already in `.gitignore`)
- Use MCP client `env` configuration
- Use the `configure_gemini_token` tool at runtime
- All example configs use `"your-api-key-here"` placeholder

### ❌ Never Commit

- `.env` files
- API keys in code
- Tokens in config files
- Real credentials in documentation

### 🔍 Security Checks

This repository includes:
- GitHub Actions secret scanning
- Pre-commit checks for common secret patterns
- Automated security audits

## 🛡️ Security Features

- Path validation and sanitization
- Input validation and limits
- Directory traversal protection
- Whitelist-based access control

## 📝 Reporting Security Issues

If you find a security vulnerability, please report it privately rather than opening a public issue.

