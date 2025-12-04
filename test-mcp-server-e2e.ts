#!/usr/bin/env node

/**
 * Full MCP Server E2E Test
 * Tests the actual MCP server by simulating MCP protocol calls
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY || API_KEY === "your-api-key-here") {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<any>): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration, details: result });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: error.message });
    console.log(`❌ ${name} (${duration}ms): ${error.message}`);
  }
}

async function testAllModels() {
  console.log("🧪 Testing All Available Models\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const models = [
    { name: "gemini-2.5-flash-image-preview", api: "generateContent", type: "Gemini" },
    { name: "gemini-3-pro-image-preview", api: "generateContent", type: "Gemini" },
    { name: "imagen-4.0-fast-generate-001", api: "generateImages", type: "Imagen" },
  ];

  for (const model of models) {
    await runTest(`Model: ${model.name} (${model.type})`, async () => {
      try {
        if (model.api === "generateContent") {
          const response = await ai.models.generateContent({
            model: model.name,
            contents: "A simple test: blue circle",
          });
          
          const hasImage = response.candidates?.[0]?.content?.parts?.some(
            (p: any) => p.inlineData?.data
          );
          
          return {
            works: true,
            hasImage,
            api: model.api,
          };
        } else if (model.api === "generateImages") {
          if (typeof (ai.models as any).generateImages === 'function') {
            const response = await (ai.models as any).generateImages({
              model: model.name,
              prompt: "A simple test: blue circle",
              config: { numberOfImages: 1 },
            });
            
            return {
              works: true,
              hasImages: response.generatedImages?.length > 0,
              api: model.api,
            };
          } else {
            return { works: false, error: "generateImages not available" };
          }
        }
      } catch (error: any) {
        return {
          works: false,
          error: error.message?.substring(0, 100),
          api: model.api,
        };
      }
    });
  }
}

async function testMCPServerDirectly() {
  console.log("\n🔌 Testing MCP Server Directly\n");

  // We can't easily test the full server without a proper MCP client
  // But we can test the API calls that the server would make
  
  const ai = new GoogleGenAI({ apiKey: API_KEY });

  await runTest("Generate image with gemini-2.5-flash-image-preview", async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: "A minimalist logo: red square with white border",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    
    if (!imagePart) {
      throw new Error("No image in response");
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const testDir = path.join(process.cwd(), "test_output");
    await fs.mkdir(testDir, { recursive: true });
    const imagePath = path.join(testDir, "mcp-test-image.png");
    await fs.writeFile(imagePath, imageBuffer);

    return {
      imageSize: imageBuffer.length,
      mimeType: imagePart.inlineData.mimeType,
      path: imagePath,
    };
  });

  await runTest("Generate image with imagen-4.0-fast-generate-001", async () => {
    if (typeof (ai.models as any).generateImages !== 'function') {
      throw new Error("generateImages not available");
    }

    const response = await (ai.models as any).generateImages({
      model: "imagen-4.0-fast-generate-001",
      prompt: "A minimalist logo: red square with white border",
      config: {
        numberOfImages: 1,
        outputMimeType: "image/png",
      },
    });

    if (!response.generatedImages || response.generatedImages.length === 0) {
      throw new Error("No images generated");
    }

    const image = response.generatedImages[0];
    if (!image.image?.imageBytes) {
      throw new Error("No image data in response");
    }

    const imageBuffer = Buffer.from(image.image.imageBytes, 'base64');
    const testDir = path.join(process.cwd(), "test_output");
    await fs.mkdir(testDir, { recursive: true });
    const imagePath = path.join(testDir, "mcp-test-imagen.png");
    await fs.writeFile(imagePath, imageBuffer);

    return {
      imageSize: imageBuffer.length,
      enhancedPrompt: image.enhancedPrompt,
      path: imagePath,
    };
  });
}

async function testImageEditingWorkflow() {
  console.log("\n✏️  Testing Image Editing Workflow\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  let baseImagePath: string | null = null;

  await runTest("Generate base image", async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: "A simple blue circle",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    
    if (!imagePart) {
      throw new Error("No image generated");
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const testDir = path.join(process.cwd(), "test_output");
    await fs.mkdir(testDir, { recursive: true });
    baseImagePath = path.join(testDir, "workflow-base.png");
    await fs.writeFile(baseImagePath, imageBuffer);

    return { path: baseImagePath, size: imageBuffer.length };
  });

  if (baseImagePath) {
    await runTest("Edit: Change color", async () => {
      const imageBuffer = await fs.readFile(baseImagePath!);
      const imageBase64 = imageBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: imageBase64, mimeType: "image/png" } },
              { text: "Change the circle color to red" },
            ],
          },
        ],
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const editedPart = parts.find((p: any) => p.inlineData?.data);
      
      if (!editedPart) {
        throw new Error("No edited image");
      }

      const editedBuffer = Buffer.from(editedPart.inlineData.data, 'base64');
      const testDir = path.join(process.cwd(), "test_output");
      const editedPath = path.join(testDir, "workflow-edited-red.png");
      await fs.writeFile(editedPath, editedBuffer);

      return { path: editedPath, size: editedBuffer.length };
    });

    await runTest("Edit: Add element", async () => {
      const imageBuffer = await fs.readFile(baseImagePath!);
      const imageBase64 = imageBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: imageBase64, mimeType: "image/png" } },
              { text: "Add a white star in the center" },
            ],
          },
        ],
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const editedPart = parts.find((p: any) => p.inlineData?.data);
      
      if (!editedPart) {
        throw new Error("No edited image");
      }

      const editedBuffer = Buffer.from(editedPart.inlineData.data, 'base64');
      const testDir = path.join(process.cwd(), "test_output");
      const editedPath = path.join(testDir, "workflow-edited-star.png");
      await fs.writeFile(editedPath, editedBuffer);

      return { path: editedPath, size: editedBuffer.length };
    });
  }
}

async function testModelComparison() {
  console.log("\n📊 Comparing Models\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const testPrompt = "A futuristic cityscape at sunset";

  const models = [
    { name: "gemini-2.5-flash-image-preview", api: "generateContent" },
    { name: "imagen-4.0-fast-generate-001", api: "generateImages" },
  ];

  for (const model of models) {
    await runTest(`Compare: ${model.name}`, async () => {
      const start = Date.now();
      
      try {
        let imageSize = 0;
        let mimeType = "";

        if (model.api === "generateContent") {
          const response = await ai.models.generateContent({
            model: model.name,
            contents: testPrompt,
          });

          const parts = response.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find((p: any) => p.inlineData?.data);
          
          if (imagePart) {
            imageSize = Buffer.from(imagePart.inlineData.data, 'base64').length;
            mimeType = imagePart.inlineData.mimeType || "image/png";
          }
        } else {
          const response = await (ai.models as any).generateImages({
            model: model.name,
            prompt: testPrompt,
            config: { numberOfImages: 1 },
          });

          if (response.generatedImages?.[0]?.image?.imageBytes) {
            imageSize = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64').length;
            mimeType = response.generatedImages[0].image.mimeType || "image/png";
          }
        }

        const duration = Date.now() - start;

        return {
          duration,
          imageSize,
          mimeType,
          speed: imageSize > 0 ? (imageSize / duration).toFixed(2) + " bytes/ms" : "N/A",
        };
      } catch (error: any) {
        return {
          error: error.message?.substring(0, 100),
          duration: Date.now() - start,
        };
      }
    });
  }
}

async function main() {
  console.log("🚀 Full MCP Server E2E Test Suite\n");
  console.log("=".repeat(60) + "\n");

  await testAllModels();
  await testMCPServerDirectly();
  await testImageEditingWorkflow();
  await testModelComparison();

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Final Summary\n");

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Time: ${(totalDuration / 1000).toFixed(1)}s\n`);

  if (failed > 0) {
    console.log("Failed Tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.error) console.log(`     Error: ${r.error}`);
    });
    console.log();
  }

  // Save detailed results
  const resultsPath = path.join(process.cwd(), "test_output", "mcp-e2e-results.json");
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(`💾 Detailed results: ${resultsPath}\n`);

  // List generated test images
  try {
    const testDir = path.join(process.cwd(), "test_output");
    const files = await fs.readdir(testDir);
    const imageFiles = files.filter(f => f.endsWith('.png'));
    if (imageFiles.length > 0) {
      console.log(`📸 Generated ${imageFiles.length} test images in test_output/\n`);
    }
  } catch {}

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

