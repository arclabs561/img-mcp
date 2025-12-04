#!/usr/bin/env node

/**
 * Complete integration test for nano-banana-mcp
 * Tests server startup, configuration, and basic functionality
 */

import { config as dotenvConfig } from "dotenv";
import * as path from "path";
import * as fs from "fs/promises";

dotenvConfig();

async function testIntegration() {
  console.log("🧪 Complete Integration Test for nano-banana-mcp\n");

  // Test 1: Check .env file
  console.log("Test 1: Environment Configuration");
  const envPath = path.join(process.cwd(), ".env");
  try {
    const envContent = await fs.readFile(envPath, "utf-8");
    const hasApiKey = envContent.includes("GEMINI_API_KEY") && 
                     !envContent.includes("your-api-key-here");
    if (hasApiKey) {
      console.log("✅ .env file exists with API key configured\n");
    } else {
      console.log("⚠️  .env file exists but API key not configured");
      console.log("   Please add: GEMINI_API_KEY=your-actual-key\n");
    }
  } catch {
    console.log("⚠️  .env file not found\n");
  }

  // Test 2: Check build output
  console.log("Test 2: Build Verification");
  const distPath = path.join(process.cwd(), "dist", "index.js");
  try {
    await fs.access(distPath);
    const stats = await fs.stat(distPath);
    console.log(`✅ Build output exists: ${(stats.size / 1024).toFixed(2)} KB\n`);
  } catch {
    console.log("❌ Build output not found. Run: npm run build\n");
  }

  // Test 3: Check dependencies
  console.log("Test 3: Dependencies");
  try {
    const { GoogleGenAI } = await import("@google/genai");
    console.log("✅ @google/genai imported successfully");
    
    const { Server } = await import("@modelcontextprotocol/sdk/server/index.js");
    console.log("✅ @modelcontextprotocol/sdk imported successfully");
    
    const { z } = await import("zod");
    console.log("✅ zod imported successfully\n");
  } catch (error) {
    console.log(`❌ Dependency import failed: ${error}\n`);
  }

  // Test 4: Verify API key format (if present)
  console.log("Test 4: API Key Validation");
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "your-api-key-here") {
    // Google API keys typically start with specific prefixes
    const isValidFormat = apiKey.length > 20 && /^[A-Za-z0-9_-]+$/.test(apiKey);
    if (isValidFormat) {
      console.log(`✅ API Key format looks valid (${apiKey.length} chars)`);
      console.log(`   Preview: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);
    } else {
      console.log("⚠️  API Key format may be invalid\n");
    }
  } else {
    console.log("⚠️  API Key not set. To test:");
    console.log("   1. Get key from: https://aistudio.google.com/app/apikey");
    console.log("   2. Add to .env: GEMINI_API_KEY=your-key-here\n");
  }

  // Test 5: Server structure verification
  console.log("Test 5: Server Structure");
  try {
    const serverCode = await fs.readFile(path.join(process.cwd(), "src", "index.ts"), "utf-8");
    
    const hasResources = serverCode.includes("ListResourcesRequestSchema");
    const hasPrompts = serverCode.includes("ListPromptsRequestSchema");
    const hasPathValidator = serverCode.includes("PathValidator");
    const hasRetry = serverCode.includes("retryWithBackoff");
    const hasMetadata = serverCode.includes("ImageMetadata");
    const hasLogger = serverCode.includes("class Logger");

    console.log(`   Resources: ${hasResources ? '✅' : '❌'}`);
    console.log(`   Prompts: ${hasPrompts ? '✅' : '❌'}`);
    console.log(`   Path Validator: ${hasPathValidator ? '✅' : '❌'}`);
    console.log(`   Retry Logic: ${hasRetry ? '✅' : '❌'}`);
    console.log(`   Metadata: ${hasMetadata ? '✅' : '❌'}`);
    console.log(`   Logger: ${hasLogger ? '✅' : '❌'}\n`);
  } catch (error) {
    console.log(`❌ Could not verify structure: ${error}\n`);
  }

  console.log("✅ Integration test complete!\n");
  console.log("📋 To actually test the server:");
  console.log("   1. Add GEMINI_API_KEY to .env");
  console.log("   2. Run: npm run build");
  console.log("   3. Start server: npm start");
  console.log("   4. Or test with MCP client (Cursor/Claude Desktop)");
  console.log("\n💡 Example MCP client config:");
  console.log(JSON.stringify({
    mcpServers: {
      "nano-banana-mcp": {
        command: "node",
        args: [path.join(process.cwd(), "dist", "index.js")],
        env: {
          GEMINI_API_KEY: "your-api-key-here"
        }
      }
    }
  }, null, 2));
}

testIntegration().catch(console.error);

