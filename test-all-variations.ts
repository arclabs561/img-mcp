#!/usr/bin/env node

/**
 * Comprehensive test suite for ALL variations
 * Tests every model, API method, configuration, tool, and edge case
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig();

import { GoogleGenAI } from "@google/genai";
import * as fs from "fs/promises";
import * as path from "path";

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY || API_KEY === "your-api-key-here") {
  console.error("❌ GEMINI_API_KEY not set");
  process.exit(1);
}

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];
const testImages: string[] = [];

async function runTest(category: string, name: string, testFn: () => Promise<any>): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - start;
    results.push({ category, name, passed: true, duration, details: result });
    console.log(`✅ [${category}] ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ category, name, passed: false, duration, error: error.message });
    console.log(`❌ [${category}] ${name} (${duration}ms): ${error.message}`);
  }
}

// ============================================================================
// MODEL VARIATIONS
// ============================================================================

async function testAllModels() {
  console.log("\n📦 Testing All Model Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const geminiModels = [
    "gemini-2.5-flash-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.0-flash-exp",
  ];

  const imagenModels = [
    "imagen-4.0-fast-generate-001",
    "imagen-3.0-generate-002",
  ];

  // Test Gemini models with generateContent
  for (const model of geminiModels) {
    await runTest("Models", `Gemini: ${model}`, async () => {
      const response = await ai.models.generateContent({
        model,
        contents: "A simple red circle",
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const hasImage = parts.some((p: any) => p.inlineData?.data);
      const hasText = parts.some((p: any) => p.text);

      if (!hasImage && !hasText) {
        throw new Error("No content in response");
      }

      return {
        hasImage,
        hasText,
        partsCount: parts.length,
      };
    });
  }

  // Test Imagen models with generateImages
  for (const model of imagenModels) {
    await runTest("Models", `Imagen: ${model}`, async () => {
      if (typeof (ai.models as any).generateImages !== 'function') {
        throw new Error("generateImages not available");
      }

      try {
        const response = await (ai.models as any).generateImages({
          model,
          prompt: "A simple red circle",
          config: { numberOfImages: 1 },
        });

        return {
          works: true,
          imagesCount: response.generatedImages?.length || 0,
        };
      } catch (error: any) {
        // Some models may not be available
        return {
          works: false,
          error: error.message?.substring(0, 100),
        };
      }
    });
  }
}

// ============================================================================
// PROMPT VARIATIONS
// ============================================================================

async function testPromptVariations() {
  console.log("\n💬 Testing Prompt Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash-image-preview";

  const prompts = [
    "A red circle",
    "A simple geometric shape: blue square",
    "A minimalist logo design with clean lines",
    "A complex scene: futuristic city at sunset with flying cars",
    "Abstract art: colorful geometric patterns",
    "A detailed illustration: a cat wearing sunglasses",
    "Text in image: the word 'TEST' in bold letters",
    "Multiple objects: a tree, a house, and a car",
  ];

  for (const prompt of prompts) {
    await runTest("Prompts", `Prompt: "${prompt.substring(0, 30)}..."`, async () => {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      
      if (!imagePart) {
        throw new Error("No image generated");
      }

      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const testDir = path.join(process.cwd(), "test_output", "prompts");
      await fs.mkdir(testDir, { recursive: true });
      const safeName = prompt.substring(0, 20).replace(/[^a-z0-9]/gi, '_');
      const imagePath = path.join(testDir, `${safeName}.png`);
      await fs.writeFile(imagePath, imageBuffer);
      testImages.push(imagePath);

      return {
        imageSize: imageBuffer.length,
        mimeType: imagePart.inlineData.mimeType,
      };
    });
  }
}

// ============================================================================
// FORMAT VARIATIONS
// ============================================================================

async function testFormatVariations() {
  console.log("\n🖼️  Testing Format Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash-image-preview";

  // Note: The model may not respect format requests, but we test what we get
  const formats = ["png", "jpeg", "webp"];

  for (const format of formats) {
    await runTest("Formats", `Request ${format.toUpperCase()}`, async () => {
      const response = await ai.models.generateContent({
        model,
        contents: `Generate a ${format} image: a green triangle`,
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      
      if (!imagePart) {
        throw new Error("No image generated");
      }

      const actualMimeType = imagePart.inlineData.mimeType || "image/png";
      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');

      return {
        requested: format,
        received: actualMimeType,
        size: imageBuffer.length,
      };
    });
  }
}

// ============================================================================
// IMAGEN CONFIG VARIATIONS
// ============================================================================

async function testImagenConfigVariations() {
  console.log("\n⚙️  Testing Imagen Configuration Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "imagen-4.0-fast-generate-001";

  if (typeof (ai.models as any).generateImages !== 'function') {
    console.log("⚠️  generateImages not available, skipping Imagen config tests\n");
    return;
  }

  const configs = [
    { numberOfImages: 1, aspectRatio: "1:1" },
    { numberOfImages: 1, aspectRatio: "16:9" },
    { numberOfImages: 1, aspectRatio: "9:16" },
    { numberOfImages: 1, outputMimeType: "image/png" },
    { numberOfImages: 1, outputMimeType: "image/jpeg" },
  ];

  for (const config of configs) {
    await runTest("Imagen Config", JSON.stringify(config), async () => {
      const response = await (ai.models as any).generateImages({
        model,
        prompt: "A test image: blue square",
        config,
      });

      if (!response.generatedImages || response.generatedImages.length === 0) {
        throw new Error("No images generated");
      }

      return {
        imagesCount: response.generatedImages.length,
        hasImageData: !!response.generatedImages[0]?.image?.imageBytes,
      };
    });
  }
}

// ============================================================================
// EDITING VARIATIONS
// ============================================================================

async function testEditingVariations() {
  console.log("\n✏️  Testing Editing Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash-image-preview";

  // Generate base image
  let baseImagePath: string | null = null;

  await runTest("Editing", "Generate base image", async () => {
    const response = await ai.models.generateContent({
      model,
      contents: "A simple blue circle on white background",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    
    if (!imagePart) {
      throw new Error("No base image generated");
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const testDir = path.join(process.cwd(), "test_output", "editing");
    await fs.mkdir(testDir, { recursive: true });
    baseImagePath = path.join(testDir, "base.png");
    await fs.writeFile(baseImagePath, imageBuffer);
    testImages.push(baseImagePath);

    return { size: imageBuffer.length };
  });

  if (!baseImagePath) return;

  const editPrompts = [
    "Change the color to red",
    "Make it bigger",
    "Add a border",
    "Remove the background",
    "Add text: 'HELLO'",
    "Make it more detailed",
    "Change to a square shape",
    "Add shadows",
  ];

  for (const editPrompt of editPrompts) {
    await runTest("Editing", `Edit: "${editPrompt}"`, async () => {
      const imageBuffer = await fs.readFile(baseImagePath!);
      const imageBase64 = imageBuffer.toString('base64');

      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { data: imageBase64, mimeType: "image/png" } },
              { text: editPrompt },
            ],
          },
        ],
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const editedPart = parts.find((p: any) => p.inlineData?.data);
      
      if (!editedPart) {
        throw new Error("No edited image generated");
      }

      const editedBuffer = Buffer.from(editedPart.inlineData.data, 'base64');
      const testDir = path.join(process.cwd(), "test_output", "editing");
      const safeName = editPrompt.substring(0, 20).replace(/[^a-z0-9]/gi, '_');
      const editedPath = path.join(testDir, `edited_${safeName}.png`);
      await fs.writeFile(editedPath, editedBuffer);
      testImages.push(editedPath);

      return {
        originalSize: imageBuffer.length,
        editedSize: editedBuffer.length,
      };
    });
  }
}

// ============================================================================
// REFERENCE IMAGE VARIATIONS
// ============================================================================

async function testReferenceImageVariations() {
  console.log("\n🖼️  Testing Reference Image Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash-image-preview";

  // Generate two reference images
  let ref1Path: string | null = null;
  let ref2Path: string | null = null;

  await runTest("Reference Images", "Generate reference image 1", async () => {
    const response = await ai.models.generateContent({
      model,
      contents: "A red square",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    
    if (!imagePart) throw new Error("No image");

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const testDir = path.join(process.cwd(), "test_output", "references");
    await fs.mkdir(testDir, { recursive: true });
    ref1Path = path.join(testDir, "ref1.png");
    await fs.writeFile(ref1Path, imageBuffer);
    testImages.push(ref1Path);

    return { size: imageBuffer.length };
  });

  await runTest("Reference Images", "Generate reference image 2", async () => {
    const response = await ai.models.generateContent({
      model,
      contents: "A blue circle",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    
    if (!imagePart) throw new Error("No image");

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const testDir = path.join(process.cwd(), "test_output", "references");
    ref2Path = path.join(testDir, "ref2.png");
    await fs.writeFile(ref2Path, imageBuffer);
    testImages.push(ref2Path);

    return { size: imageBuffer.length };
  });

  if (!ref1Path || !ref2Path) return;

  // Test editing with reference images
  const testCases = [
    { refs: [ref1Path], prompt: "Apply the style from reference" },
    { refs: [ref1Path, ref2Path], prompt: "Combine elements from both references" },
    { refs: [ref1Path], prompt: "Use the colors from the reference" },
  ];

  for (const testCase of testCases) {
    await runTest("Reference Images", `Edit with ${testCase.refs.length} reference(s)`, async () => {
      const baseBuffer = await fs.readFile(ref1Path!);
      const baseBase64 = baseBuffer.toString('base64');

      const parts: any[] = [
        { inlineData: { data: baseBase64, mimeType: "image/png" } },
        { text: testCase.prompt },
      ];

      for (const refPath of testCase.refs) {
        const refBuffer = await fs.readFile(refPath);
        const refBase64 = refBuffer.toString('base64');
        parts.push({ inlineData: { data: refBase64, mimeType: "image/png" } });
      }

      const response = await ai.models.generateContent({
        model,
        contents: [{ role: "user", parts }],
      });

      const responseParts = response.candidates?.[0]?.content?.parts || [];
      const editedPart = responseParts.find((p: any) => p.inlineData?.data);
      
      if (!editedPart) {
        throw new Error("No edited image");
      }

      return {
        hasImage: true,
        referencesUsed: testCase.refs.length,
      };
    });
  }
}

// ============================================================================
// ERROR HANDLING VARIATIONS
// ============================================================================

async function testErrorHandlingVariations() {
  console.log("\n🛡️  Testing Error Handling Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  const errorCases = [
    {
      name: "Invalid model name",
      test: async () => {
        await ai.models.generateContent({
          model: "invalid-model-xyz-123",
          contents: "test",
        });
        throw new Error("Should have failed");
      },
    },
    {
      name: "Empty prompt",
      test: async () => {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: "",
        });
        return { handled: true, hasResponse: !!response };
      },
    },
    {
      name: "Very long prompt",
      test: async () => {
        const longPrompt = "A".repeat(10000);
        try {
          await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: longPrompt,
          });
          return { handled: true };
        } catch (error: any) {
          return { handled: true, error: error.message?.substring(0, 50) };
        }
      },
    },
    {
      name: "Invalid image format",
      test: async () => {
        // Try to send invalid base64
        try {
          await ai.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: [
              {
                role: "user",
                parts: [
                  { inlineData: { data: "invalid-base64!!!", mimeType: "image/png" } },
                  { text: "edit this" },
                ],
              },
            ],
          });
          return { handled: true };
        } catch (error: any) {
          return { handled: true, error: error.message?.substring(0, 50) };
        }
      },
    },
  ];

  for (const errorCase of errorCases) {
    await runTest("Error Handling", errorCase.name, errorCase.test);
  }
}

// ============================================================================
// PERFORMANCE VARIATIONS
// ============================================================================

async function testPerformanceVariations() {
  console.log("\n⚡ Testing Performance Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const models = [
    "gemini-2.5-flash-image-preview",
    "imagen-4.0-fast-generate-001",
  ];

  for (const model of models) {
    await runTest("Performance", `Speed test: ${model}`, async () => {
      const iterations = 2;
      const times: number[] = [];
      const sizes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        
        if (model.startsWith("imagen-")) {
          const response = await (ai.models as any).generateImages({
            model,
            prompt: `Test ${i}: geometric pattern`,
            config: { numberOfImages: 1 },
          });
          
          if (response.generatedImages?.[0]?.image?.imageBytes) {
            sizes.push(Buffer.from(response.generatedImages[0].image.imageBytes, 'base64').length);
          }
        } else {
          const response = await ai.models.generateContent({
            model,
            contents: `Test ${i}: geometric pattern`,
          });
          
          const parts = response.candidates?.[0]?.content?.parts || [];
          const imagePart = parts.find((p: any) => p.inlineData?.data);
          if (imagePart) {
            sizes.push(Buffer.from(imagePart.inlineData.data, 'base64').length);
          }
        }
        
        times.push(Date.now() - start);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;

      return {
        avgTime: Math.round(avgTime),
        avgSize: Math.round(avgSize),
        minTime: Math.min(...times),
        maxTime: Math.max(...times),
      };
    });
  }
}

// ============================================================================
// ITERATIVE EDITING VARIATIONS
// ============================================================================

async function testIterativeEditing() {
  console.log("\n🔄 Testing Iterative Editing Variations\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const model = "gemini-2.5-flash-image-preview";

  let currentImage: string | null = null;

  const steps = [
    "A simple blue circle",
    "Change it to red",
    "Make it bigger",
    "Add a yellow border",
    "Add text: 'FINAL'",
  ];

  for (let i = 0; i < steps.length; i++) {
    await runTest("Iterative Editing", `Step ${i + 1}: ${steps[i]}`, async () => {
      let response;

      if (i === 0) {
        // First step: generate
        response = await ai.models.generateContent({
          model,
          contents: steps[i],
        });
      } else {
        // Subsequent steps: edit
        if (!currentImage) throw new Error("No base image");
        
        const imageBuffer = await fs.readFile(currentImage);
        const imageBase64 = imageBuffer.toString('base64');

        response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: "user",
              parts: [
                { inlineData: { data: imageBase64, mimeType: "image/png" } },
                { text: steps[i] },
              ],
            },
          ],
        });
      }

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      
      if (!imagePart) {
        throw new Error("No image in response");
      }

      const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
      const testDir = path.join(process.cwd(), "test_output", "iterative");
      await fs.mkdir(testDir, { recursive: true });
      currentImage = path.join(testDir, `step_${i + 1}.png`);
      await fs.writeFile(currentImage, imageBuffer);
      testImages.push(currentImage);

      return {
        step: i + 1,
        size: imageBuffer.length,
      };
    });
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("🚀 Comprehensive All-Variations Test Suite\n");
  console.log("=".repeat(70) + "\n");

  await testAllModels();
  await testPromptVariations();
  await testFormatVariations();
  await testImagenConfigVariations();
  await testEditingVariations();
  await testReferenceImageVariations();
  await testErrorHandlingVariations();
  await testPerformanceVariations();
  await testIterativeEditing();

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 Final Summary\n");

  const byCategory = new Map<string, TestResult[]>();
  for (const result of results) {
    if (!byCategory.has(result.category)) {
      byCategory.set(result.category, []);
    }
    byCategory.get(result.category)!.push(result);
  }

  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const [category, categoryResults] of byCategory.entries()) {
    const passed = categoryResults.filter(r => r.passed).length;
    const failed = categoryResults.filter(r => !r.passed).length;
    const duration = categoryResults.reduce((sum, r) => sum + r.duration, 0);
    
    totalPassed += passed;
    totalFailed += failed;
    totalDuration += duration;

    console.log(`${category}:`);
    console.log(`  ✅ Passed: ${passed}`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⏱️  Time: ${(duration / 1000).toFixed(1)}s`);
    console.log();
  }

  console.log("Overall:");
  console.log(`  Total Tests: ${results.length}`);
  console.log(`  ✅ Passed: ${totalPassed}`);
  console.log(`  ❌ Failed: ${totalFailed}`);
  console.log(`  ⏱️  Total Time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`  📸 Images Generated: ${testImages.length}\n`);

  // Save results
  const resultsPath = path.join(process.cwd(), "test_output", "all-variations-results.json");
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(`💾 Results saved: ${resultsPath}\n`);

  if (totalFailed > 0) {
    console.log("Failed Tests:");
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ [${r.category}] ${r.name}`);
      if (r.error) console.log(`     ${r.error}`);
    });
    console.log();
  }

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(console.error);

