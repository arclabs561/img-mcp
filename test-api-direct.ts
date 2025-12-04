#!/usr/bin/env node

/**
 * Direct API test - tests Google GenAI API directly
 * This helps verify the API key works and understand the actual API structure
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

async function testAPI() {
  console.log("🧪 Testing Google GenAI API directly\n");

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    console.log("✅ GoogleGenAI client created\n");

    // Test 1: Check available models
    console.log("Test 1: Checking API connectivity...");
    
    // Try to generate content (text) to verify API key works
    console.log("   Testing with a simple text generation...");
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: "Say hello in one word",
      });
      
      if (response.candidates && response.candidates[0]?.content?.parts) {
        const text = response.candidates[0].content.parts.find(p => p.text)?.text;
        console.log(`   ✅ API key works! Response: ${text}\n`);
      } else {
        console.log("   ⚠️  API responded but no text content\n");
      }
    } catch (error: any) {
      console.log(`   ⚠️  Text generation test: ${error.message}`);
      if (error.message?.includes("API key")) {
        console.log("   ❌ API key may be invalid\n");
      } else {
        console.log("   (This might be expected - continuing to image test)\n");
      }
    }

    // Test 2: Try image generation API
    console.log("Test 2: Testing image generation API...");
    console.log("   Attempting to use generateImages() method...");
    
    try {
      // Check if generateImages method exists
      if (typeof (ai.models as any).generateImages === 'function') {
        console.log("   ✅ generateImages() method exists");
        console.log("   💡 The API supports generateImages() for image generation\n");
      } else {
        console.log("   ⚠️  generateImages() method not found");
        console.log("   💡 May need to use generateContent() for nano-banana model\n");
      }
    } catch (error: any) {
      console.log(`   ⚠️  Error checking generateImages: ${error.message}\n`);
    }

    // Test 3: Check model availability
    console.log("Test 3: Model information");
    console.log("   Target model: gemini-2.5-flash-image-preview");
    console.log("   Alternative: gemini-2.0-flash-exp");
    console.log("   💡 Note: The nano-banana model may use generateContent() instead of generateImages()\n");

    console.log("✅ API connectivity test complete!\n");
    console.log("💡 Next: Test actual image generation with the MCP server");

  } catch (error: any) {
    console.error("❌ API test failed:", error.message);
    if (error.stack) {
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  }
}

testAPI().catch(console.error);

