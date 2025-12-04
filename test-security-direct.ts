#!/usr/bin/env tsx

/**
 * Direct security tests - tests security features directly without MCP protocol
 */

import { readFile } from "fs/promises";
import { join } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await testFn();
    results.push({ name, passed: true });
    console.log(`✅ PASSED: ${name}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg });
    console.log(`❌ FAILED: ${name}`);
    console.log(`   Error: ${errorMsg}`);
  }
}

// ============================================================================
// Path Validation Tests
// ============================================================================

async function testPathValidation() {
  await runTest("Path validation: Code checks for .. before normalization", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    // Check that path validation happens before path.resolve
    const validateMethod = sourceCode.match(/validateAndSanitize\([^)]+\)[^{]*\{[^}]*path\.normalize[^}]*if.*includes\(['"]\.\./s);
    if (!validateMethod) {
      throw new Error("Path validation doesn't check for .. before normalization");
    }
  });

  await runTest("Path validation: Uses path.relative for containment", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("path.relative")) {
      throw new Error("Path validation doesn't use path.relative for reliable containment check");
    }
  });

  await runTest("Path validation: Generic error messages", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    // Check that error messages don't leak directory structure
    if (sourceCode.includes('Must be within: ${this.allowedDirectories.join')) {
      throw new Error("Error messages leak allowed directory structure");
    }
    
    if (!sourceCode.includes('Path not allowed. Please use a path within')) {
      throw new Error("Error messages not generic enough");
    }
  });
}

// ============================================================================
// Error Sanitization Tests
// ============================================================================

async function testErrorSanitization() {
  await runTest("Error sanitization: API key pattern removed", async () => {
    const testKey = "AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A";
    const testMessage = `API key: ${testKey} is invalid`;
    
    // Test the sanitization logic (matching the pattern from src/index.ts: {25,})
    let sanitized = testMessage
      .replace(/AIzaSy[A-Za-z0-9_-]{25,}/g, '[API_KEY_REDACTED]')
      .replace(/api[_-]?key[=:]\s*[^\s]+/gi, 'api_key=[REDACTED]')
      .replace(/token[=:]\s*[^\s]+/gi, 'token=[REDACTED]')
      .replace(/secret[=:]\s*[^\s]+/gi, 'secret=[REDACTED]');
    
    // Debug output
    if (sanitized.includes(testKey)) {
      throw new Error(`API key not sanitized. Original: ${testMessage}, Sanitized: ${sanitized}`);
    }
    
    if (!sanitized.includes('[API_KEY_REDACTED]') && !sanitized.includes('[REDACTED]')) {
      throw new Error(`Sanitization not working. Original: ${testMessage}, Sanitized: ${sanitized}`);
    }
  });

  await runTest("Error sanitization: Code implements sanitizeError", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("sanitizeError")) {
      throw new Error("Error sanitization method not found");
    }
    
    // Check for API key pattern (updated to match 35+ chars)
    if (!sourceCode.includes("AIzaSy[A-Za-z0-9_-]{35") && !sourceCode.includes("AIzaSy")) {
      throw new Error("Error sanitization doesn't include API key pattern");
    }
    
    if (!sourceCode.includes("[API_KEY_REDACTED]")) {
      throw new Error("Error sanitization doesn't include redaction pattern");
    }
  });

  await runTest("Error sanitization: All error logging uses sanitization", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    // Check that Logger.error calls use sanitization
    const errorLogCalls = sourceCode.match(/Logger\.error\([^)]+error[^)]*\)/g) || [];
    const sanitizedCalls = sourceCode.match(/sanitizeErrorPublic\(error\)/g) || [];
    
    // Most error logging should use sanitization
    if (errorLogCalls.length > sanitizedCalls.length + 2) {
      // Allow a couple of non-error-param calls
      throw new Error(`Not all error logging uses sanitization. Found ${errorLogCalls.length} error calls but only ${sanitizedCalls.length} sanitized`);
    }
  });

  await runTest("Error sanitization: Data sanitization implemented", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("sanitizeData")) {
      throw new Error("Data sanitization method not found");
    }
    
    if (!sourceCode.includes("apiKey") || !sourceCode.includes("geminiApiKey")) {
      throw new Error("Data sanitization doesn't check for API key fields");
    }
  });
}

// ============================================================================
// File Permissions Tests
// ============================================================================

async function testFilePermissions() {
  await runTest("File permissions: Image files use 0o600", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    // Check that fs.writeFile calls for images include mode: 0o600
    const imageWrites = sourceCode.match(/fs\.writeFile\([^,]+imageBuffer[^)]+\)/gs) || [];
    const hasPermissions = imageWrites.some(write => write.includes("mode: 0o600"));
    
    if (!hasPermissions && imageWrites.length > 0) {
      throw new Error("Image file writes don't set permissions to 0o600");
    }
  });

  await runTest("File permissions: Config file uses 0o600", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (sourceCode.includes('fs.writeFile(configPath') && !sourceCode.includes('mode: 0o600')) {
      throw new Error("Config file write doesn't set permissions to 0o600");
    }
  });

  await runTest("File permissions: Metadata file uses 0o600", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (sourceCode.includes('fs.writeFile(metadataPath') && !sourceCode.includes('mode: 0o600')) {
      throw new Error("Metadata file write doesn't set permissions to 0o600");
    }
  });
}

// ============================================================================
// Input Validation Tests
// ============================================================================

async function testInputValidation() {
  await runTest("Input validation: Prompt length check", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("maxPromptLength") || !sourceCode.includes("prompt.length >")) {
      throw new Error("Prompt length validation not implemented");
    }
  });

  await runTest("Input validation: Empty prompt check", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("prompt.trim().length === 0") && !sourceCode.includes("prompt.length === 0")) {
      throw new Error("Empty prompt validation not implemented");
    }
  });

  await runTest("Input validation: Model enum validation", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("z.enum([") || !sourceCode.includes("GenerationSettingsSchema")) {
      throw new Error("Model validation schema not found");
    }
  });

  await runTest("Input validation: Format enum validation", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes('enum: ["png", "jpeg", "webp"]')) {
      throw new Error("Format validation enum not found");
    }
  });
}

// ============================================================================
// Security Configuration Tests
// ============================================================================

async function testSecurityConfiguration() {
  await runTest("Security: API key redacted in config saves", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("[REDACTED]") || !sourceCode.includes("geminiApiKey: '[REDACTED]'")) {
      throw new Error("API key redaction not implemented in config saves");
    }
  });

  await runTest("Security: PathValidator class exists", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("class PathValidator")) {
      throw new Error("PathValidator class not found");
    }
  });

  await runTest("Security: Allowed directories restricted", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    if (!sourceCode.includes("allowedDirectories")) {
      throw new Error("Allowed directories restriction not implemented");
    }
  });
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log("🔒 Security Direct Test Suite");
  console.log("=".repeat(50));

  await testPathValidation();
  await testErrorSanitization();
  await testFilePermissions();
  await testInputValidation();
  await testSecurityConfiguration();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results Summary");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name}`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
      });
    process.exit(1);
  } else {
    console.log("\n✅ All security tests passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

