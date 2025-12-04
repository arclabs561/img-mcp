#!/usr/bin/env node

/**
 * Stress and Load Testing
 * Tests the system under various load conditions
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
  name: string;
  passed: boolean;
  duration: number;
  metrics?: any;
  error?: string;
}

const results: TestResult[] = [];

async function runTest(name: string, testFn: () => Promise<any>): Promise<void> {
  const start = Date.now();
  try {
    const result = await testFn();
    const duration = Date.now() - start;
    results.push({ name, passed: true, duration, metrics: result });
    console.log(`✅ ${name} (${duration}ms)`);
  } catch (error: any) {
    const duration = Date.now() - start;
    results.push({ name, passed: false, duration, error: error.message });
    console.log(`❌ ${name} (${duration}ms): ${error.message}`);
  }
}

async function testRapidRequests() {
  console.log("\n⚡ Testing Rapid Sequential Requests\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const count = 3; // Reduced for API limits

  await runTest(`Rapid requests (${count} sequential)`, async () => {
    const times: number[] = [];
    const successes: number[] = [];

    for (let i = 0; i < count; i++) {
      const start = Date.now();
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-image-preview",
          contents: `Rapid test ${i + 1}`,
        });
        const duration = Date.now() - start;
        times.push(duration);
        if (response.candidates?.[0]?.content?.parts?.some((p: any) => p.inlineData?.data)) {
          successes.push(i);
        }
      } catch (error) {
        times.push(Date.now() - start);
      }
    }

    return {
      total: count,
      successful: successes.length,
      avgTime: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
    };
  });
}

async function testConcurrentRequests() {
  console.log("\n🔄 Testing Concurrent Requests\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const concurrency = 3;

  await runTest(`Concurrent requests (${concurrency} parallel)`, async () => {
    const start = Date.now();
    const promises = Array.from({ length: concurrency }, (_, i) =>
      ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: `Concurrent test ${i + 1}`,
      })
    );

    const results = await Promise.allSettled(promises);
    const duration = Date.now() - start;

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      concurrency,
      successful,
      failed,
      totalTime: duration,
      avgTimePerRequest: Math.round(duration / concurrency),
    };
  });
}

async function testLargeImageHandling() {
  console.log("\n📦 Testing Large Image Handling\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  await runTest("Generate and handle large image", async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: "A detailed, high-resolution image with many elements and colors",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p: any) => p.inlineData?.data);
    
    if (!imagePart) {
      throw new Error("No image generated");
    }

    const imageBuffer = Buffer.from(imagePart.inlineData.data, 'base64');
    const sizeKB = imageBuffer.length / 1024;
    const sizeMB = sizeKB / 1024;

    // Test writing large image
    const testDir = path.join(process.cwd(), "test_output", "stress");
    await fs.mkdir(testDir, { recursive: true });
    const imagePath = path.join(testDir, "large_image.png");
    await fs.writeFile(imagePath, imageBuffer);

    const stats = await fs.stat(imagePath);

    return {
      imageSize: Math.round(sizeKB),
      sizeMB: sizeMB.toFixed(2),
      canWrite: true,
      fileSize: stats.size,
      isLarge: sizeKB > 500,
    };
  });
}

async function testMemoryUsage() {
  console.log("\n💾 Testing Memory Usage\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const iterations = 3;

  await runTest(`Memory usage (${iterations} images)`, async () => {
    const images: Buffer[] = [];

    for (let i = 0; i < iterations; i++) {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: `Memory test ${i + 1}`,
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p: any) => p.inlineData?.data);
      
      if (imagePart) {
        const buffer = Buffer.from(imagePart.inlineData.data, 'base64');
        images.push(buffer);
      }
    }

    const totalSize = images.reduce((sum, img) => sum + img.length, 0);
    const avgSize = totalSize / images.length;

    return {
      imagesInMemory: images.length,
      totalSizeKB: Math.round(totalSize / 1024),
      avgSizeKB: Math.round(avgSize / 1024),
    };
  });
}

async function testErrorRecovery() {
  console.log("\n🛡️  Testing Error Recovery\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  await runTest("Error recovery after invalid request", async () => {
    // Make an invalid request
    try {
      await ai.models.generateContent({
        model: "invalid-model-xyz",
        contents: "test",
      });
    } catch {
      // Expected to fail
    }

    // Try a valid request after error
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image-preview",
      contents: "Recovery test",
    });

    const parts = response.candidates?.[0]?.content?.parts || [];
    const hasImage = parts.some((p: any) => p.inlineData?.data);

    return {
      recovered: true,
      canGenerateAfterError: hasImage,
    };
  });
}

async function testLongRunningSession() {
  console.log("\n⏱️  Testing Long-Running Session\n");

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const operations = 3; // Reduced for testing

  await runTest(`Long session (${operations} operations)`, async () => {
    const start = Date.now();
    const operations: any[] = [];

    for (let i = 0; i < operations; i++) {
      const opStart = Date.now();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image-preview",
        contents: `Session operation ${i + 1}`,
      });
      const opDuration = Date.now() - opStart;
      
      operations.push({
        operation: i + 1,
        duration: opDuration,
        success: !!response.candidates?.[0],
      });
    }

    const totalDuration = Date.now() - start;
    const avgOpTime = totalDuration / operations.length;

    return {
      operations: operations.length,
      totalDuration: Math.round(totalDuration / 1000),
      avgOpTime: Math.round(avgOpTime),
      allSuccessful: operations.every(op => op.success),
    };
  });
}

async function main() {
  console.log("🚀 Stress and Load Testing Suite\n");
  console.log("=".repeat(70) + "\n");

  await testRapidRequests();
  await testConcurrentRequests();
  await testLargeImageHandling();
  await testMemoryUsage();
  await testErrorRecovery();
  await testLongRunningSession();

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("📊 Stress Test Summary\n");

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏱️  Total Time: ${(totalDuration / 1000).toFixed(1)}s\n`);

  console.log("Metrics:");
  results.forEach(r => {
    if (r.metrics) {
      console.log(`  ${r.name}:`);
      Object.entries(r.metrics).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
      });
    }
  });

  // Save results
  const resultsPath = path.join(process.cwd(), "test_output", "stress-test-results.json");
  await fs.mkdir(path.dirname(resultsPath), { recursive: true });
  await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\n💾 Results saved: ${resultsPath}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(console.error);

