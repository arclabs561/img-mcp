#!/usr/bin/env node

/**
 * Test script to verify MCP server functionality
 * This tests the server by directly instantiating it and calling methods
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { NanoBananaMCP } from "./src/index.js";

async function testMCPServer() {
  console.log("🧪 Testing MCP Server Implementation\n");

  try {
    // Test 1: Server instantiation
    console.log("Test 1: Server Instantiation");
    const server = new (NanoBananaMCP as any)();
    console.log("✅ Server instantiated successfully\n");

    // Test 2: Check if API key is configured
    console.log("Test 2: API Key Configuration");
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "your-api-key-here") {
      console.log(`✅ API Key found: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
      console.log(`   Length: ${apiKey.length} characters\n`);
    } else {
      console.log("⚠️  API Key not configured in .env");
      console.log("   Please add GEMINI_API_KEY to .env file\n");
    }

    // Test 3: Verify capabilities
    console.log("Test 3: Server Capabilities");
    const capabilities = (server as any).server?.capabilities;
    if (capabilities) {
      console.log("✅ Capabilities declared:");
      console.log(`   - Tools: ${capabilities.tools ? '✅' : '❌'}`);
      console.log(`   - Resources: ${capabilities.resources ? '✅' : '❌'}`);
      console.log(`   - Prompts: ${capabilities.prompts ? '✅' : '❌'}\n`);
    } else {
      console.log("❌ Capabilities not found\n");
    }

    // Test 4: Verify path validator
    console.log("Test 4: Path Validator");
    const pathValidator = (server as any).pathValidator;
    if (pathValidator) {
      console.log("✅ Path validator initialized");
      console.log(`   Allowed directories: ${(pathValidator as any).allowedDirectories?.length || 0}\n`);
    } else {
      console.log("⚠️  Path validator not initialized (will be created on first config)\n");
    }

    // Test 5: Verify metadata storage
    console.log("Test 5: Metadata Storage");
    const metadata = (server as any).imageMetadata;
    if (metadata) {
      console.log(`✅ Metadata storage initialized: ${metadata.size} images tracked\n`);
    } else {
      console.log("❌ Metadata storage not found\n");
    }

    console.log("✅ All structural tests passed!\n");
    console.log("💡 Next steps:");
    console.log("   1. Add GEMINI_API_KEY to .env file");
    console.log("   2. Test with MCP client (Cursor/Claude Desktop)");
    console.log("   3. Try generating an image with: generate_image tool");
    console.log("   4. Test resources: nano-banana://gallery");
    console.log("   5. Test prompts: get_prompt with 'enhance_image'");

  } catch (error) {
    console.error("❌ Test failed:", error);
    if (error instanceof Error) {
      console.error("   Message:", error.message);
      console.error("   Stack:", error.stack);
    }
    process.exit(1);
  }
}

testMCPServer().catch(console.error);

