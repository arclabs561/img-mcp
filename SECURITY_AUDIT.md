# Security Audit Report

**Date**: 2025-12-04  
**Auditor**: Automated Security Review  
**Scope**: Full codebase security assessment

## Executive Summary

Overall security posture: **GOOD** with some areas for improvement. The codebase implements solid security practices including path validation, input sanitization, and secret management. However, several vulnerabilities and improvements are identified.

---

## 🔴 Critical Issues

### 1. Path Traversal Vulnerability in PathValidator

**Location**: `src/index.ts:162-188`

**Issue**: The path traversal check is insufficient:
```typescript
if (resolvedPath.includes('..')) {
  throw new McpError(...);
}
```

**Problem**: 
- `path.resolve()` already normalizes paths, so `..` may not appear in the resolved path even if it was in the input
- The check happens after resolution, which means some traversal attempts might bypass detection
- Windows paths with `..` in different positions might not be caught

**Recommendation**:
```typescript
validateAndSanitize(filePath: string): string {
  // Normalize and resolve
  const normalized = path.normalize(filePath);
  const resolvedPath = path.resolve(normalized);
  
  // Check for directory traversal BEFORE resolution
  if (normalized.includes('..') || filePath.includes('..')) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Path contains directory traversal: ${filePath}`
    );
  }
  
  // Additional check: ensure resolved path is within allowed directories
  const isAllowed = this.allowedDirectories.some(allowedDir => {
    const resolvedAllowed = path.resolve(allowedDir);
    // Use path.relative to check containment more reliably
    const relative = path.relative(resolvedAllowed, resolvedPath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  });
  
  if (!isAllowed) {
    throw new McpError(...);
  }
  
  return resolvedPath;
}
```

**Severity**: HIGH  
**CVSS**: 7.5 (High)

---

### 2. API Key Potentially Logged in Error Messages

**Location**: `src/index.ts:965-969`

**Issue**: Error messages might leak API key information if the Google API error includes it:
```typescript
Logger.error("Failed to generate image", { 
  error: error instanceof Error ? error.message : String(error) 
});
throw new McpError(
  ErrorCode.InternalError,
  `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`
);
```

**Problem**: Google API errors might include partial API keys or sensitive information in error messages.

**Recommendation**: Sanitize error messages:
```typescript
private sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // Remove potential API key patterns
  return message
    .replace(/AIzaSy[A-Za-z0-9_-]{35}/g, '[API_KEY_REDACTED]')
    .replace(/api[_-]?key[=:]\s*[^\s]+/gi, 'api_key=[REDACTED]');
}
```

**Severity**: MEDIUM  
**CVSS**: 5.3 (Medium)

---

## 🟡 Medium Issues

### 3. File Permissions Not Explicitly Set

**Location**: `src/index.ts:913`

**Issue**: Files are written without explicit permissions:
```typescript
await fs.writeFile(filePath, imageBuffer);
```

**Problem**: Default permissions might be too permissive (world-readable).

**Recommendation**:
```typescript
await fs.writeFile(filePath, imageBuffer, { mode: 0o600 }); // Owner read/write only
```

**Severity**: MEDIUM  
**CVSS**: 4.3 (Medium)

---

### 4. Information Disclosure in Error Messages

**Location**: Multiple locations

**Issue**: Error messages reveal internal paths and directory structure:
```typescript
`Path not allowed: ${filePath}. Must be within: ${this.allowedDirectories.join(', ')}`
```

**Problem**: Reveals allowed directory structure to potential attackers.

**Recommendation**: Generic error messages:
```typescript
`Path not allowed. Please use a path within the configured image directory.`
```

**Severity**: LOW  
**CVSS**: 3.1 (Low)

---

### 5. Missing Rate Limiting

**Location**: All tool handlers

**Issue**: No rate limiting on API calls, which could lead to:
- API quota exhaustion
- Cost overruns
- DoS attacks

**Recommendation**: Implement rate limiting:
```typescript
private rateLimiter = new Map<string, { count: number; resetAt: number }>();

private checkRateLimit(identifier: string, maxRequests: number = 10, windowMs: number = 60000): void {
  const now = Date.now();
  const limit = this.rateLimiter.get(identifier);
  
  if (!limit || now > limit.resetAt) {
    this.rateLimiter.set(identifier, { count: 1, resetAt: now + windowMs });
    return;
  }
  
  if (limit.count >= maxRequests) {
    throw new McpError(ErrorCode.RateLimited, "Rate limit exceeded. Please try again later.");
  }
  
  limit.count++;
}
```

**Severity**: MEDIUM  
**CVSS**: 5.3 (Medium)

---

### 6. Config File Permissions

**Location**: `src/index.ts:1515-1521`

**Issue**: Config file is written without explicit permissions:
```typescript
await fs.writeFile(configPath, JSON.stringify(configToSave, null, 2));
```

**Recommendation**:
```typescript
await fs.writeFile(configPath, JSON.stringify(configToSave, null, 2), { mode: 0o600 });
```

**Severity**: MEDIUM  
**CVSS**: 4.3 (Medium)

---

## 🟢 Low Issues / Improvements

### 7. Missing Input Size Limits on Base64 Images

**Location**: `src/index.ts:1010`

**Issue**: Base64-encoded images are decoded without size validation before decoding.

**Recommendation**: Validate base64 size before decoding:
```typescript
const maxBase64Size = 20 * 1024 * 1024; // 20MB base64 ≈ 15MB binary
if (imageBase64.length > maxBase64Size) {
  throw new McpError(ErrorCode.InvalidParams, "Image too large");
}
```

**Severity**: LOW  
**CVSS**: 2.5 (Low)

---

### 8. Metadata File Permissions

**Location**: `src/index.ts:1527`

**Issue**: Metadata file written without explicit permissions.

**Recommendation**: Set restrictive permissions.

**Severity**: LOW  
**CVSS**: 2.5 (Low)

---

### 9. Missing Content-Type Validation

**Location**: Image processing functions

**Issue**: MIME types are trusted from API responses without validation.

**Recommendation**: Whitelist allowed MIME types:
```typescript
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
if (!ALLOWED_MIME_TYPES.includes(imageMimeType)) {
  throw new McpError(ErrorCode.InvalidParams, "Invalid image format");
}
```

**Severity**: LOW  
**CVSS**: 2.5 (Low)

---

## ✅ Security Strengths

1. **Path Validation**: PathValidator class exists and attempts to prevent directory traversal
2. **Input Validation**: Zod schemas validate all inputs
3. **Secret Management**: API keys are redacted in config files when from environment
4. **Error Handling**: Structured error handling with MCP error codes
5. **Logging**: Structured JSON logging (though needs sanitization)
6. **Git Security**: `.env` files in `.gitignore`, CI checks for secrets
7. **Dependencies**: No known vulnerabilities in dependencies
8. **CI/CD Security**: GitHub Actions workflows for secret scanning

---

## 📋 Recommendations Summary

### Immediate Actions (Critical/High)
1. ✅ Fix path traversal vulnerability in PathValidator
2. ✅ Sanitize error messages to prevent API key leakage
3. ✅ Set explicit file permissions (0o600) for sensitive files

### Short-term (Medium Priority)
4. ✅ Implement rate limiting
5. ✅ Improve error messages to avoid information disclosure
6. ✅ Add base64 size validation before decoding

### Long-term (Low Priority)
7. ✅ Add content-type validation
8. ✅ Consider adding request signing/authentication
9. ✅ Add audit logging for sensitive operations

---

## 🔍 Additional Security Checks Performed

- ✅ No hardcoded secrets in current files
- ⚠️ Secrets exist in git history (documented in SECURITY_HISTORY.md)
- ✅ Dependencies have no known vulnerabilities
- ✅ `.env` files properly ignored
- ✅ CI/CD includes secret scanning
- ✅ Input validation present (Zod schemas)
- ⚠️ Path validation needs improvement
- ⚠️ Error message sanitization needed
- ⚠️ File permissions not explicitly set

---

## 📊 Risk Assessment

| Category | Risk Level | Count |
|----------|-----------|-------|
| Critical | 🔴 High | 1 |
| High | 🟡 Medium | 5 |
| Medium | 🟢 Low | 3 |
| **Total** | | **9** |

**Overall Risk**: **MEDIUM** - Codebase is generally secure but has several areas requiring immediate attention.

---

## 🛡️ Security Best Practices Followed

- ✅ Environment variable usage for secrets
- ✅ Input validation with Zod
- ✅ Structured error handling
- ✅ Path validation (needs improvement)
- ✅ Secret scanning in CI/CD
- ✅ `.gitignore` properly configured
- ✅ No secrets in current codebase

---

## 📝 Notes

- Git history contains an API key (see SECURITY_HISTORY.md for cleanup instructions)
- All example configs use placeholders
- CI will fail if secrets are detected in new commits
- Security workflow scans history weekly

---

**Next Steps**: 
1. Address critical path traversal vulnerability
2. Implement error message sanitization
3. Set explicit file permissions
4. Consider implementing rate limiting

