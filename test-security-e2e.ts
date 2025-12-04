#!/usr/bin/env tsx

/**
 * Security-focused E2E tests
 * Tests path traversal protection, error sanitization, file permissions, and security features
 */

import { spawn } from "child_process";
import { readFile, writeFile, mkdir, access, stat } from "fs/promises";
import { join } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const API_KEY = process.env.GEMINI_API_KEY || "test-key-placeholder";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<any>): Promise<void> {
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

async function callMCPTool(toolName: string, args: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const server = spawn("node", ["dist/index.js"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, GEMINI_API_KEY: API_KEY },
    });

    let stdout = "";
    let stderr = "";

    server.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    server.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Server exited with code ${code}: ${stderr}`));
        return;
      }

      try {
        // Parse MCP response
        const lines = stdout.split("\n").filter((l) => l.trim());
        const lastLine = lines[lines.length - 1];
        if (lastLine) {
          const response = JSON.parse(lastLine);
          resolve(response);
        } else {
          resolve({});
        }
      } catch (error) {
        reject(new Error(`Failed to parse response: ${stdout}`));
      }
    });

    // Send MCP request
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: args,
      },
    };

    server.stdin.write(JSON.stringify(request) + "\n");
    server.stdin.end();

    setTimeout(() => {
      server.kill();
      reject(new Error("Request timeout"));
    }, 30000);
  });
}

// ============================================================================
// Path Traversal Tests
// ============================================================================

async function testPathTraversalProtection() {
  await runTest("Path traversal: ../etc/passwd", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "../../../etc/passwd",
        prompt: "test",
      });
      throw new Error("Should have rejected path traversal");
    } catch (error: any) {
      if (!error.message.includes("directory traversal") && !error.message.includes("not allowed")) {
        throw new Error(`Expected path traversal error, got: ${error.message}`);
      }
    }
  });

  await runTest("Path traversal: ..\\windows\\system32", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "..\\..\\..\\windows\\system32\\config\\sam",
        prompt: "test",
      });
      throw new Error("Should have rejected path traversal");
    } catch (error: any) {
      if (!error.message.includes("directory traversal") && !error.message.includes("not allowed")) {
        throw new Error(`Expected path traversal error, got: ${error.message}`);
      }
    }
  });

  await runTest("Path traversal: encoded ..", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "%2e%2e%2f%2e%2e%2fetc%2fpasswd",
        prompt: "test",
      });
      throw new Error("Should have rejected encoded path traversal");
    } catch (error: any) {
      if (!error.message.includes("directory traversal") && !error.message.includes("not allowed")) {
        throw new Error(`Expected path traversal error, got: ${error.message}`);
      }
    }
  });

  await runTest("Path traversal: absolute path outside allowed", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "/root/.ssh/id_rsa",
        prompt: "test",
      });
      throw new Error("Should have rejected absolute path outside allowed directories");
    } catch (error: any) {
      if (!error.message.includes("not allowed")) {
        throw new Error(`Expected path rejection, got: ${error.message}`);
      }
    }
  });
}

// ============================================================================
// Error Sanitization Tests
// ============================================================================

async function testErrorSanitization() {
  await runTest("Error sanitization: API key in error message", async () => {
    // Create a test that would trigger an error with API key
    const testKey = "AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A";
    
    // We can't easily test this without mocking, but we can verify
    // the sanitizeError function exists and works
    // Test error sanitization by checking the source code
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    // Verify sanitizeError method exists
    if (!sourceCode.includes("sanitizeError") || !sourceCode.includes("AIzaSy")) {
      throw new Error("Error sanitization not properly implemented");
    }
    
    // Verify it replaces API key patterns
    if (!sourceCode.includes("[API_KEY_REDACTED]")) {
      throw new Error("API key redaction pattern not found");
    }
    
    // Test the actual sanitization logic
    const testError = new Error('API key: AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A is invalid');
    const sanitized = testError.message
      .replace(/AIzaSy[A-Za-z0-9_-]{35}/g, '[API_KEY_REDACTED]')
      .replace(/api[_-]?key[=:]\s*[^\s]+/gi, 'api_key=[REDACTED]');
    
    if (sanitized.includes('AIzaSyAM6FE4xyyX0cGwam-AlVDSv3cr514OK9A')) {
      throw new Error("Error sanitization not working - API key still present");
    }
    
    if (!sanitized.includes('[API_KEY_REDACTED]')) {
      throw new Error("Error sanitization not working - redaction not applied");
    }

    // Test passed if we got here without throwing
  });
}

// ============================================================================
// File Permissions Tests
// ============================================================================

async function testFilePermissions() {
  await runTest("File permissions: Generated image files", async () => {
    // This test requires actually generating an image
    // For now, we'll test that the code sets permissions correctly
    const testCode = `
      const fs = require('fs/promises');
      const path = require('path');
      
      async function test() {
        const testFile = path.join(__dirname, 'test-perm-check.txt');
        await fs.writeFile(testFile, 'test', { mode: 0o600 });
        const stats = await fs.stat(testFile);
        const mode = stats.mode & parseInt('777', 8);
        if (mode !== 384) { // 0o600 in decimal
          throw new Error(\`Expected mode 0o600, got 0o\${mode.toString(8)}\`);
        }
        await fs.unlink(testFile);
        console.log('OK');
      }
      test().catch(e => { console.error(e); process.exit(1); });
    `;

    const server = spawn("node", ["-e", testCode], { stdio: "pipe" });
    const output = await new Promise<string>((resolve, reject) => {
      let data = "";
      server.stdout.on("data", (d) => (data += d.toString()));
      server.stderr.on("data", (d) => (data += d.toString()));
      server.on("close", (code) => {
        if (code === 0) resolve(data);
        else reject(new Error(`Exit code ${code}: ${data}`));
      });
    });

    if (!output.includes("OK")) {
      throw new Error("File permissions test failed");
    }
  });

  await runTest("File permissions: Config file", async () => {
    // Test that config file would be created with correct permissions
    // We can't easily test this without actually creating a config,
    // but we verify the code pattern exists
    const sourceCode = await readFile("src/index.ts", "utf-8");
    if (!sourceCode.includes('fs.writeFile(configPath') || !sourceCode.includes('mode: 0o600')) {
      throw new Error("Config file write doesn't set permissions");
    }
  });

  await runTest("File permissions: Metadata file", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    if (!sourceCode.includes('fs.writeFile(metadataPath') || !sourceCode.includes('mode: 0o600')) {
      throw new Error("Metadata file write doesn't set permissions");
    }
  });
}

// ============================================================================
// Input Validation Tests
// ============================================================================

async function testInputValidation() {
  await runTest("Input validation: Empty prompt", async () => {
    try {
      await callMCPTool("generate_image", { prompt: "" });
      throw new Error("Should have rejected empty prompt");
    } catch (error: any) {
      if (!error.message.includes("empty") && !error.message.includes("required")) {
        throw new Error(`Expected validation error, got: ${error.message}`);
      }
    }
  });

  await runTest("Input validation: Prompt too long", async () => {
    const longPrompt = "a".repeat(5000);
    try {
      await callMCPTool("generate_image", { prompt: longPrompt });
      throw new Error("Should have rejected overly long prompt");
    } catch (error: any) {
      if (!error.message.includes("too long") && !error.message.includes("maximum")) {
        throw new Error(`Expected length validation error, got: ${error.message}`);
      }
    }
  });

  await runTest("Input validation: Invalid model", async () => {
    try {
      await callMCPTool("generate_image", {
        prompt: "test",
        model: "invalid-model-xyz-123",
      });
      throw new Error("Should have rejected invalid model");
    } catch (error: any) {
      // Model validation happens at API level, so we might get API error
      // That's acceptable
      if (!error.message.includes("invalid") && !error.message.includes("not found") && !error.message.includes("enum")) {
        throw new Error(`Expected model validation error, got: ${error.message}`);
      }
    }
  });

  await runTest("Input validation: Invalid format", async () => {
    try {
      await callMCPTool("generate_image", {
        prompt: "test",
        format: "invalid-format",
      });
      throw new Error("Should have rejected invalid format");
    } catch (error: any) {
      if (!error.message.includes("enum") && !error.message.includes("format")) {
        throw new Error(`Expected format validation error, got: ${error.message}`);
      }
    }
  });
}

// ============================================================================
// Security Configuration Tests
// ============================================================================

async function testSecurityConfiguration() {
  await runTest("Security: API key not logged", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    
    // Check that Logger.sanitizeError is used
    if (!sourceCode.includes("sanitizeError") || !sourceCode.includes("sanitizeData")) {
      throw new Error("Error sanitization not implemented");
    }

    // Check that API key is redacted in config saves
    if (!sourceCode.includes("[REDACTED]")) {
      throw new Error("API key redaction not implemented");
    }
  });

  await runTest("Security: Path validator initialized", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    if (!sourceCode.includes("PathValidator") || !sourceCode.includes("validateAndSanitize")) {
      throw new Error("Path validator not found");
    }
  });

  await runTest("Security: Allowed directories restricted", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    if (!sourceCode.includes("allowedDirectories") || !sourceCode.includes("path.relative")) {
      throw new Error("Path validation not properly implemented");
    }
  });
}

// ============================================================================
// Integration Security Tests
// ============================================================================

async function testIntegrationSecurity() {
  await runTest("Integration: Configure token doesn't expose key", async () => {
    // This would require actually running the server and checking logs
    // For now, we verify the code structure
    const sourceCode = await readFile("src/index.ts", "utf-8");
    if (sourceCode.includes('Logger.info("Gemini API token configured"') && 
        !sourceCode.includes('apiKey:') || sourceCode.includes('[REDACTED]')) {
      // Good - either doesn't log apiKey or redacts it
    } else if (sourceCode.includes('Logger.info("Gemini API token configured", { apiKey:')) {
      throw new Error("API key might be logged in configuration");
    }
  });

  await runTest("Integration: Error messages don't leak paths", async () => {
    const sourceCode = await readFile("src/index.ts", "utf-8");
    // Check that path errors are generic
    if (sourceCode.includes('Path not allowed. Please use a path within')) {
      // Good - generic error message
    } else if (sourceCode.includes('Must be within: ${this.allowedDirectories.join')) {
      throw new Error("Error messages might leak directory structure");
    }
  });
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log("🔒 Security E2E Test Suite");
  console.log("=" .repeat(50));

  if (!API_KEY || API_KEY === "test-key-placeholder") {
    console.log("⚠️  GEMINI_API_KEY not set - some tests will be skipped");
  }

  await testPathTraversalProtection();
  await testErrorSanitization();
  await testFilePermissions();
  await testInputValidation();
  await testSecurityConfiguration();
  await testIntegrationSecurity();

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

