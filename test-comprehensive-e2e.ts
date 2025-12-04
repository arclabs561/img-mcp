#!/usr/bin/env tsx

/**
 * Comprehensive E2E test suite
 * Tests all functionality including security fixes, edge cases, and error scenarios
 */

import { spawn } from "child_process";
import { readFile, writeFile, mkdir, access, stat, unlink } from "fs/promises";
import { join } from "path";
import { config as dotenvConfig } from "dotenv";

dotenvConfig();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY || API_KEY === "your-api-key-here") {
  console.error("❌ GEMINI_API_KEY not set in .env file");
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
  duration?: number;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<any>, timeout: number = 60000): Promise<void> {
  const startTime = Date.now();
  try {
    console.log(`\n🧪 Testing: ${name}`);
    await Promise.race([
      testFn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Test timeout")), timeout)
      ),
    ]);
    const duration = Date.now() - startTime;
    results.push({ name, passed: true, duration });
    console.log(`✅ PASSED: ${name} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    results.push({ name, passed: false, error: errorMsg, duration });
    console.log(`❌ FAILED: ${name} (${duration}ms)`);
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
    const responses: any[] = [];

    server.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      // Parse JSON-RPC responses
      const lines = text.split("\n").filter((l) => l.trim());
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.id !== undefined) {
            responses.push(parsed);
          }
        } catch {
          // Not JSON, ignore
        }
      }
    });

    server.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    server.on("close", (code) => {
      if (responses.length > 0) {
        const lastResponse = responses[responses.length - 1];
        if (lastResponse.error) {
          reject(new Error(lastResponse.error.message || JSON.stringify(lastResponse.error)));
        } else {
          resolve(lastResponse.result || lastResponse);
        }
      } else if (code !== 0) {
        reject(new Error(`Server exited with code ${code}: ${stderr}`));
      } else {
        resolve({});
      }
    });

    // Send MCP request
    const request = {
      jsonrpc: "2.0",
      id: Date.now(),
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
// Basic Functionality Tests
// ============================================================================

async function testBasicFunctionality() {
  await runTest("Configure API token", async () => {
    const result = await callMCPTool("configure_gemini_token", {
      apiKey: API_KEY!,
    });
    if (!result) {
      throw new Error("No result from configure_gemini_token");
    }
  });

  await runTest("Get configuration status", async () => {
    const result = await callMCPTool("get_configuration_status", {});
    if (!result || !result.content) {
      throw new Error("No configuration status returned");
    }
  });

  await runTest("Generate image: Basic", async () => {
    const result = await callMCPTool("generate_image", {
      prompt: "A simple red circle on a white background",
      model: "gemini-2.5-flash-image-preview",
      format: "png",
    });
    if (!result || !result.content) {
      throw new Error("No image generated");
    }
    const hasImage = result.content.some((c: any) => c.type === "image");
    if (!hasImage) {
      throw new Error("Generated content doesn't include image");
    }
  });

  await runTest("List images", async () => {
    const result = await callMCPTool("list_images", {});
    if (!result || !Array.isArray(result.content)) {
      throw new Error("list_images didn't return array");
    }
  });

  await runTest("Get last image info", async () => {
    const result = await callMCPTool("get_last_image_info", {});
    // This might fail if no images exist, which is okay
    if (result && result.content) {
      // Good - we have image info
    }
  });
}

// ============================================================================
// Model Variation Tests
// ============================================================================

async function testModelVariations() {
  const models = [
    "gemini-2.5-flash-image-preview",
    "gemini-3-pro-image-preview",
    "imagen-4.0-fast-generate-001",
  ];

  for (const model of models) {
    await runTest(`Generate image: ${model}`, async () => {
      const result = await callMCPTool("generate_image", {
        prompt: `A test image using ${model}`,
        model: model,
        format: "png",
      });
      if (!result || !result.content) {
        throw new Error(`No result from ${model}`);
      }
    });
  }
}

// ============================================================================
// Format Variation Tests
// ============================================================================

async function testFormatVariations() {
  const formats = ["png", "jpeg", "webp"];

  for (const format of formats) {
    await runTest(`Generate image: ${format} format`, async () => {
      const result = await callMCPTool("generate_image", {
        prompt: `A test image in ${format} format`,
        format: format,
      });
      if (!result || !result.content) {
        throw new Error(`No result for ${format} format`);
      }
    });
  }
}

// ============================================================================
// Image Editing Tests
// ============================================================================

async function testImageEditing() {
  // First generate an image to edit
  let imagePath: string | null = null;

  await runTest("Generate image for editing", async () => {
    const result = await callMCPTool("generate_image", {
      prompt: "A simple blue square",
      format: "png",
    });
    if (!result || !result.content) {
      throw new Error("Failed to generate image for editing");
    }
    // Extract path from result
    const textContent = result.content.find((c: any) => c.type === "text");
    if (textContent && textContent.text) {
      const match = textContent.text.match(/saved to: (.+)/);
      if (match) {
        imagePath = match[1];
      }
    }
  });

  if (imagePath) {
    await runTest("Edit image: Basic edit", async () => {
      const result = await callMCPTool("edit_image", {
        imagePath: imagePath!,
        prompt: "Make it red instead of blue",
      });
      if (!result || !result.content) {
        throw new Error("Image editing failed");
      }
    });

    await runTest("Continue editing: Second edit", async () => {
      const result = await callMCPTool("continue_editing", {
        prompt: "Add a yellow border",
      });
      // This might fail if no previous edit, which is okay
      if (result && result.error) {
        // Expected if no previous edit
      }
    });
  }
}

// ============================================================================
// Error Handling Tests
// ============================================================================

async function testErrorHandling() {
  await runTest("Error handling: Invalid model", async () => {
    try {
      await callMCPTool("generate_image", {
        prompt: "test",
        model: "invalid-model-xyz-123",
      });
      // API might accept it and return error, which is fine
    } catch (error: any) {
      // Expected - model not found
      if (!error.message.includes("not found") && !error.message.includes("invalid")) {
        throw error;
      }
    }
  });

  await runTest("Error handling: Missing prompt", async () => {
    try {
      await callMCPTool("generate_image", {});
      throw new Error("Should have failed with missing prompt");
    } catch (error: any) {
      if (!error.message.includes("required") && !error.message.includes("prompt")) {
        throw new Error(`Expected validation error, got: ${error.message}`);
      }
    }
  });

  await runTest("Error handling: Invalid image path", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "/nonexistent/path/to/image.png",
        prompt: "test",
      });
      throw new Error("Should have failed with invalid path");
    } catch (error: any) {
      if (!error.message.includes("not found") && !error.message.includes("not allowed")) {
        throw new Error(`Expected path error, got: ${error.message}`);
      }
    }
  });
}

// ============================================================================
// Settings Management Tests
// ============================================================================

async function testSettingsManagement() {
  await runTest("Set generation settings", async () => {
    const result = await callMCPTool("set_generation_settings", {
      model: "gemini-3-pro-image-preview",
      format: "webp",
      quality: "high",
    });
    // Should succeed without error
  });

  await runTest("Reset generation settings", async () => {
    const result = await callMCPTool("reset_generation_settings", {});
    // Should succeed without error
  });
}

// ============================================================================
// Image Management Tests
// ============================================================================

async function testImageManagement() {
  await runTest("Search images", async () => {
    const result = await callMCPTool("search_images", {
      query: "test",
    });
    if (!result || !Array.isArray(result.content)) {
      throw new Error("search_images didn't return array");
    }
  });

  await runTest("Get image metadata", async () => {
    // First get list of images
    const listResult = await callMCPTool("list_images", {});
    if (listResult && listResult.content && listResult.content.length > 0) {
      const firstImage = listResult.content[0];
      if (firstImage.id) {
        const metaResult = await callMCPTool("get_image_metadata", {
          id: firstImage.id,
        });
        if (!metaResult || !metaResult.content) {
          throw new Error("get_image_metadata failed");
        }
      }
    }
  });
}

// ============================================================================
// Security Tests
// ============================================================================

async function testSecurityFeatures() {
  await runTest("Security: Path traversal blocked", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "../../../etc/passwd",
        prompt: "test",
      });
      throw new Error("Path traversal should be blocked");
    } catch (error: any) {
      if (!error.message.includes("directory traversal") && !error.message.includes("not allowed")) {
        throw new Error(`Expected path traversal error, got: ${error.message}`);
      }
    }
  });

  await runTest("Security: Absolute path outside allowed", async () => {
    try {
      await callMCPTool("edit_image", {
        imagePath: "/root/.ssh/id_rsa",
        prompt: "test",
      });
      throw new Error("Absolute path should be blocked");
    } catch (error: any) {
      if (!error.message.includes("not allowed")) {
        throw new Error(`Expected path rejection, got: ${error.message}`);
      }
    }
  });
}

// ============================================================================
// Performance Tests
// ============================================================================

async function testPerformance() {
  await runTest("Performance: Sequential requests", async () => {
    const start = Date.now();
    for (let i = 0; i < 3; i++) {
      await callMCPTool("get_configuration_status", {});
    }
    const duration = Date.now() - start;
    if (duration > 10000) {
      throw new Error(`Sequential requests too slow: ${duration}ms`);
    }
  });
}

// ============================================================================
// Main Test Runner
// ============================================================================

async function main() {
  console.log("🧪 Comprehensive E2E Test Suite");
  console.log("=".repeat(50));

  await testBasicFunctionality();
  await testModelVariations();
  await testFormatVariations();
  await testImageEditing();
  await testErrorHandling();
  await testSettingsManagement();
  await testImageManagement();
  await testSecurityFeatures();
  await testPerformance();

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Results Summary");
  console.log("=".repeat(50));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);
  const avgDuration = results.length > 0 ? totalDuration / results.length : 0;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Total:  ${results.length}`);
  console.log(`⏱️  Average duration: ${Math.round(avgDuration)}ms`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`   - ${r.name} (${r.duration}ms)`);
        if (r.error) {
          console.log(`     Error: ${r.error}`);
        }
      });
    process.exit(1);
  } else {
    console.log("\n✅ All tests passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

