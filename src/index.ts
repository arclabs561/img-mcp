#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  Tool,
  CallToolRequest,
  CallToolResult,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import { config as dotenvConfig } from "dotenv";
import os from "os";

// Load environment variables
dotenvConfig();

// ============================================================================
// Configuration Schemas
// ============================================================================

const ConfigSchema = z.object({
  geminiApiKey: z.string().min(1, "Gemini API key is required"),
  model: z.string().default("gemini-2.5-flash-image-preview"),
  defaultFormat: z.enum(["png", "jpeg", "webp"]).default("png"),
  outputDirectory: z.string().optional(),
  maxImageSize: z.number().default(10 * 1024 * 1024), // 10MB
  maxPromptLength: z.number().default(4000),
  maxReferenceImages: z.number().default(5),
});

const GenerationSettingsSchema = z.object({
  model: z.enum([
    "gemini-2.5-flash-image-preview",
    "gemini-2.0-flash-exp",
    "gemini-3-pro-image-preview",
    "imagen-4.0-fast-generate-001",
    "imagen-3.0-generate-002",
  ]).optional(),
  format: z.enum(["png", "jpeg", "webp"]).optional(),
  quality: z.enum(["low", "medium", "high"]).optional(),
});

type Config = z.infer<typeof ConfigSchema>;
type GenerationSettings = z.infer<typeof GenerationSettingsSchema>;

// ============================================================================
// Image Metadata Interface
// ============================================================================

interface ImageMetadata {
  id: string;
  filePath: string;
  uri: string;
  prompt: string;
  type: "generated" | "edited";
  timestamp: string;
  model: string;
  format: string;
  size: number;
  referenceImages?: string[];
  parentImageId?: string;
}

// ============================================================================
// Logger Utility
// ============================================================================

class Logger {
  private static log(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data }),
    };
    // Write to stderr as per MCP best practices
    console.error(JSON.stringify(logEntry));
  }

  static debug(message: string, data?: any) {
    this.log("DEBUG", message, data);
  }

  static info(message: string, data?: any) {
    this.log("INFO", message, data);
  }

  static warn(message: string, data?: any) {
    this.log("WARN", message, data);
  }

  static error(message: string, data?: any) {
    this.log("ERROR", message, data);
  }
}

// ============================================================================
// Retry Utility with Exponential Backoff
// ============================================================================

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Don't retry on certain errors
      if (error instanceof McpError) {
        const errorCode = (error as any).code;
        if (errorCode === ErrorCode.InvalidParams || errorCode === ErrorCode.InvalidRequest) {
          throw error;
        }
      }
      
      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        Logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, { error: lastError.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error("Unknown error");
}

// ============================================================================
// Path Validation and Sanitization
// ============================================================================

class PathValidator {
  private allowedDirectories: string[];
  private imagesDirectory: string;

  constructor(imagesDirectory: string) {
    this.imagesDirectory = imagesDirectory;
    this.allowedDirectories = [
      imagesDirectory,
      process.cwd(),
      os.homedir(),
    ];
  }

  validateAndSanitize(filePath: string): string {
    // Resolve to absolute path
    const resolvedPath = path.resolve(filePath);
    
    // Check for directory traversal attempts
    if (resolvedPath.includes('..')) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Path contains directory traversal: ${filePath}. Paths must be within allowed directories.`
      );
    }

    // Check if path is within allowed directories
    const isAllowed = this.allowedDirectories.some(allowedDir => {
      const resolvedAllowed = path.resolve(allowedDir);
      return resolvedPath.startsWith(resolvedAllowed + path.sep) || resolvedPath === resolvedAllowed;
    });

    if (!isAllowed) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Path not allowed: ${filePath}. Must be within: ${this.allowedDirectories.join(', ')}`
      );
    }

    return resolvedPath;
  }

  isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
  }
}

// ============================================================================
// Main MCP Server Class
// ============================================================================

class ImgMcp {
  private server: Server;
  private genAI: GoogleGenAI | null = null;
  private config: Config | null = null;
  private configSource: 'environment' | 'config_file' | 'not_configured' = 'not_configured';
  private lastImagePath: string | null = null;
  private imageMetadata: Map<string, ImageMetadata> = new Map();
  private pathValidator: PathValidator | null = null;
  private generationSettings: GenerationSettings = {};

  constructor() {
    this.server = new Server(
      {
        name: "img-mcp",
        version: "2.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.setupHandlers();
  }

  // ==========================================================================
  // Handler Setup
  // ==========================================================================

  private setupHandlers() {
    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupPromptHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: "configure_gemini_token",
            description: "Configure your Gemini API token for image generation",
            inputSchema: {
              type: "object",
              properties: {
                apiKey: {
                  type: "string",
                  description: "Your Gemini API key from Google AI Studio",
                },
              },
              required: ["apiKey"],
            },
          },
          {
            name: "configure_generation_settings",
            description: "Configure image generation parameters (model, format, quality)",
            inputSchema: {
              type: "object",
              properties: {
                model: {
                  type: "string",
                  enum: [
                    "gemini-2.5-flash-image-preview",
                    "gemini-2.0-flash-exp",
                    "gemini-3-pro-image-preview",
                    "imagen-4.0-fast-generate-001",
                    "imagen-3.0-generate-002",
                  ],
                  description: "Model to use for image generation. Gemini models use generateContent(), Imagen models use generateImages()",
                },
                format: {
                  type: "string",
                  enum: ["png", "jpeg", "webp"],
                  description: "Default image format",
                },
                quality: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                  description: "Image quality setting",
                },
              },
            },
          },
          {
            name: "generate_image",
            description: "Generate a NEW image from text prompt. Use this ONLY when creating a completely new image, not when modifying an existing one.",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text prompt describing the NEW image to create from scratch",
                },
                model: {
                  type: "string",
                  enum: [
                    "gemini-2.5-flash-image-preview",
                    "gemini-2.0-flash-exp",
                    "gemini-3-pro-image-preview",
                    "imagen-4.0-fast-generate-001",
                    "imagen-3.0-generate-002",
                  ],
                  description: "Optional: Override default model for this generation",
                },
                format: {
                  type: "string",
                  enum: ["png", "jpeg", "webp"],
                  description: "Optional: Override default format for this generation",
                },
              },
              required: ["prompt"],
            },
          },
          {
            name: "edit_image",
            description: "Edit a SPECIFIC existing image file, optionally using additional reference images. Use this when you have the exact file path of an image to modify.",
            inputSchema: {
              type: "object",
              properties: {
                imagePath: {
                  type: "string",
                  description: "Full file path to the main image file to edit",
                },
                prompt: {
                  type: "string",
                  description: "Text describing the modifications to make to the existing image",
                },
                referenceImages: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional array of file paths to additional reference images",
                  maxItems: 5,
                },
              },
              required: ["imagePath", "prompt"],
            },
          },
          {
            name: "continue_editing",
            description: "Continue editing the LAST image that was generated or edited in this session",
            inputSchema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Text describing the modifications to make",
                },
                referenceImages: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional array of reference image paths",
                  maxItems: 5,
                },
              },
              required: ["prompt"],
            },
          },
          {
            name: "list_images",
            description: "List all generated and edited images with metadata",
            inputSchema: {
              type: "object",
              properties: {
                limit: {
                  type: "number",
                  description: "Maximum number of images to return",
                  default: 50,
                },
                type: {
                  type: "string",
                  enum: ["generated", "edited", "all"],
                  description: "Filter by image type",
                  default: "all",
                },
              },
            },
          },
          {
            name: "get_image_metadata",
            description: "Get detailed metadata about a specific image",
            inputSchema: {
              type: "object",
              properties: {
                imageId: {
                  type: "string",
                  description: "Image ID or URI (img://image/{id})",
                },
              },
              required: ["imageId"],
            },
          },
          {
            name: "delete_image",
            description: "Delete a specific image and its metadata",
            inputSchema: {
              type: "object",
              properties: {
                imageId: {
                  type: "string",
                  description: "Image ID or URI to delete",
                },
              },
              required: ["imageId"],
            },
          },
          {
            name: "search_images",
            description: "Search images by prompt text, date range, or other criteria",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query (searches in prompts)",
                },
                startDate: {
                  type: "string",
                  description: "Start date (ISO format)",
                },
                endDate: {
                  type: "string",
                  description: "End date (ISO format)",
                },
                type: {
                  type: "string",
                  enum: ["generated", "edited", "all"],
                },
              },
            },
          },
          {
            name: "get_configuration_status",
            description: "Check if Gemini API token is configured and view current settings",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
          {
            name: "get_last_image_info",
            description: "Get information about the last generated/edited image",
            inputSchema: {
              type: "object",
              properties: {},
              additionalProperties: false,
            },
          },
        ] as Tool[],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request: CallToolRequest): Promise<CallToolResult> => {
      try {
        const toolName = request.params.name;
        Logger.info(`Tool called: ${toolName}`, { arguments: request.params.arguments });

        switch (toolName) {
          case "configure_gemini_token":
            return await this.configureGeminiToken(request);
          case "configure_generation_settings":
            return await this.configureGenerationSettings(request);
          case "generate_image":
            return await this.generateImage(request);
          case "edit_image":
            return await this.editImage(request);
          case "continue_editing":
            return await this.continueEditing(request);
          case "list_images":
            return await this.listImages(request);
          case "get_image_metadata":
            return await this.getImageMetadata(request);
          case "delete_image":
            return await this.deleteImage(request);
          case "search_images":
            return await this.searchImages(request);
          case "get_configuration_status":
            return await this.getConfigurationStatus();
          case "get_last_image_info":
            return await this.getLastImageInfo();
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
        }
      } catch (error) {
        if (error instanceof McpError) {
          Logger.error(`Tool error: ${request.params.name}`, { code: (error as any).code, message: error.message });
          throw error;
        }
        Logger.error(`Tool execution failed: ${request.params.name}`, { error: error instanceof Error ? error.message : String(error) });
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    });
  }

  private setupResourceHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = [
        {
          uri: "img://gallery",
          name: "Image Gallery",
          description: "Browse all generated and edited images",
          mimeType: "application/json",
        },
        {
          uri: "img://config",
          name: "Configuration",
          description: "View current configuration (without sensitive data)",
          mimeType: "application/json",
        },
      ];

      // Add individual image resources
      for (const [id, metadata] of this.imageMetadata.entries()) {
        resources.push({
          uri: metadata.uri,
          name: `Image: ${id}`,
          description: `Generated image: ${metadata.prompt.substring(0, 50)}...`,
          mimeType: `image/${metadata.format}`,
        });
      }

      return { resources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      if (uri === "img://gallery") {
        const images = Array.from(this.imageMetadata.values()).map(meta => ({
          id: meta.id,
          uri: meta.uri,
          prompt: meta.prompt,
          type: meta.type,
          timestamp: meta.timestamp,
          filePath: meta.filePath,
        }));
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify({ images }, null, 2),
            },
          ],
        };
      }

      if (uri === "img://config") {
        const configInfo = {
          configured: this.config !== null,
          model: this.generationSettings.model || this.config?.model || "gemini-2.5-flash-image-preview",
          format: this.generationSettings.format || this.config?.defaultFormat || "png",
          configSource: this.configSource,
        };
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(configInfo, null, 2),
            },
          ],
        };
      }

      // Handle individual image resources: img://image/{id}
      if (uri.startsWith("img://image/")) {
        const imageId = uri.replace("img://image/", "");
        const metadata = this.imageMetadata.get(imageId);
        
        if (!metadata) {
          throw new McpError(ErrorCode.InvalidParams, `Image not found: ${imageId}`);
        }

        try {
          const imageBuffer = await fs.readFile(metadata.filePath);
          const imageBase64 = imageBuffer.toString('base64');
          
          return {
            contents: [
              {
                uri,
                mimeType: `image/${metadata.format}`,
                blob: imageBase64,
              },
            ],
          };
        } catch (error) {
          throw new McpError(ErrorCode.InternalError, `Failed to read image: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`);
    });
  }

  private setupPromptHandlers() {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: [
          {
            name: "enhance_image",
            description: "Template for enhancing image quality and details",
            arguments: [
              {
                name: "image_path",
                description: "Path to the image to enhance",
                required: true,
              },
              {
                name: "enhancement_type",
                description: "Type of enhancement: quality, sharpness, colors, lighting",
                required: false,
              },
            ],
          },
          {
            name: "style_transfer",
            description: "Template for transferring style from one image to another",
            arguments: [
              {
                name: "image_path",
                description: "Path to the base image",
                required: true,
              },
              {
                name: "style_reference",
                description: "Path to the style reference image",
                required: true,
              },
              {
                name: "intensity",
                description: "Style transfer intensity (1-10)",
                required: false,
              },
            ],
          },
          {
            name: "remove_background",
            description: "Template for removing background from an image",
            arguments: [
              {
                name: "image_path",
                description: "Path to the image",
                required: true,
              },
            ],
          },
          {
            name: "add_object",
            description: "Template for adding an object to an image",
            arguments: [
              {
                name: "image_path",
                description: "Path to the base image",
                required: true,
              },
              {
                name: "object_description",
                description: "Description of the object to add",
                required: true,
              },
              {
                name: "position",
                description: "Position where to add the object",
                required: false,
              },
            ],
          },
          {
            name: "adjust_colors",
            description: "Template for adjusting image colors",
            arguments: [
              {
                name: "image_path",
                description: "Path to the image",
                required: true,
              },
              {
                name: "adjustment",
                description: "Type of adjustment: brightness, contrast, saturation, hue",
                required: true,
              },
              {
                name: "value",
                description: "Adjustment value (-100 to 100)",
                required: true,
              },
            ],
          },
        ],
      };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const promptTemplates: Record<string, (args: Record<string, any>) => string> = {
        enhance_image: (a) => {
          const type = a.enhancement_type || "quality";
          return `Enhance the image quality by improving ${type}. Make the image sharper, more detailed, and visually appealing while maintaining the original composition and style.`;
        },
        style_transfer: (a) => {
          const intensity = a.intensity || 5;
          return `Apply the artistic style from the reference image to the base image with intensity level ${intensity}/10. Blend the styles naturally while preserving the main subject and composition of the base image.`;
        },
        remove_background: () => {
          return `Remove the background from this image, leaving only the main subject. Make the background transparent or replace it with a clean, simple background.`;
        },
        add_object: (a) => {
          const position = a.position ? ` at ${a.position}` : "";
          return `Add ${a.object_description}${position} to this image. Make it look natural and well-integrated with the existing scene, lighting, and perspective.`;
        },
        adjust_colors: (a) => {
          return `Adjust the ${a.adjustment} of this image by ${a.value > 0 ? '+' : ''}${a.value}. Maintain the overall look and feel while applying the color adjustment.`;
        },
      };

      const template = promptTemplates[name];
      if (!template) {
        throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${name}`);
      }

      const promptText = template(args || {});

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: promptText,
            },
          },
        ],
      };
    });
  }

  // ==========================================================================
  // Tool Implementations
  // ==========================================================================

  private async configureGeminiToken(request: CallToolRequest): Promise<CallToolResult> {
    const { apiKey } = request.params.arguments as { apiKey: string };
    
    try {
      ConfigSchema.parse({ geminiApiKey: apiKey });
      
      this.config = { 
        geminiApiKey: apiKey,
        model: "gemini-2.5-flash-image-preview",
        defaultFormat: "png",
        maxImageSize: 10 * 1024 * 1024,
        maxPromptLength: 4000,
        maxReferenceImages: 5,
      };
      this.genAI = new GoogleGenAI({ apiKey });
      this.configSource = 'config_file';
      
      // Initialize path validator
      const imagesDir = this.getImagesDirectory();
      this.pathValidator = new PathValidator(imagesDir);
      
      await this.saveConfig();
      
      Logger.info("Gemini API token configured", { source: this.configSource });
      
      return {
        content: [
          {
            type: "text",
            text: "Gemini API token configured successfully. You can now use image generation features.",
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid API key: ${error.errors[0]?.message}`);
      }
      throw error;
    }
  }

  private async configureGenerationSettings(request: CallToolRequest): Promise<CallToolResult> {
    const args = request.params.arguments as Partial<GenerationSettings>;
    
    try {
      this.generationSettings = GenerationSettingsSchema.parse(args);
      
      Logger.info("Generation settings updated", { settings: this.generationSettings });
      
      return {
        content: [
          {
            type: "text",
            text: `Generation settings updated:\n${JSON.stringify(this.generationSettings, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(ErrorCode.InvalidParams, `Invalid settings: ${error.errors[0]?.message}`);
      }
      throw error;
    }
  }

  private async generateImage(request: CallToolRequest): Promise<CallToolResult> {
    if (!this.ensureConfigured()) {
      throw new McpError(ErrorCode.InvalidRequest, "Gemini API token not configured. Use configure_gemini_token first.");
    }

    const { prompt, model, format } = request.params.arguments as { 
      prompt: string;
      model?: string;
      format?: string;
    };

    // Validate prompt
    if (!prompt || prompt.trim().length === 0) {
      throw new McpError(ErrorCode.InvalidParams, "Prompt cannot be empty");
    }

    if (prompt.length > (this.config?.maxPromptLength || 4000)) {
      throw new McpError(ErrorCode.InvalidParams, `Prompt too long. Maximum length: ${this.config?.maxPromptLength || 4000}`);
    }

    const selectedModel = model || this.generationSettings.model || this.config?.model || "gemini-2.5-flash-image-preview";
    const selectedFormat = format || this.generationSettings.format || this.config?.defaultFormat || "png";

    Logger.info("Generating image", { model: selectedModel, format: selectedFormat, promptLength: prompt.length });

    try {
      const isImagen = this.isImagenModel(selectedModel);
      const content: any[] = [];
      const savedFiles: string[] = [];
      let textContent = "";
      let imageData: string | null = null;
      let imageMimeType = `image/${selectedFormat}`;

      const imagesDir = this.getImagesDirectory();
      await fs.mkdir(imagesDir, { recursive: true, mode: 0o755 });

      if (isImagen && typeof (this.genAI!.models as any).generateImages === 'function') {
        // Use generateImages() for Imagen models
        Logger.debug("Using generateImages() API for Imagen model", { model: selectedModel });
        
        const response = await retryWithBackoff(async () => {
          return await (this.genAI!.models as any).generateImages({
            model: selectedModel,
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: `image/${selectedFormat}`,
            },
          });
        });

        if (response.generatedImages && response.generatedImages.length > 0) {
          const generatedImage = response.generatedImages[0];
          if (generatedImage.image?.imageBytes) {
            imageData = generatedImage.imageBytes;
            imageMimeType = generatedImage.image.mimeType || `image/${selectedFormat}`;
            
            if (generatedImage.enhancedPrompt) {
              textContent = generatedImage.enhancedPrompt;
            }
          }
        }
      } else {
        // Use generateContent() for Gemini models
        Logger.debug("Using generateContent() API for Gemini model", { model: selectedModel });
        
        const response = await retryWithBackoff(async () => {
          return await this.genAI!.models.generateContent({
            model: selectedModel,
            contents: prompt,
          });
        });

        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.text) {
              textContent += part.text;
            }

            if (part.inlineData?.data) {
              imageData = part.inlineData.data;
              imageMimeType = part.inlineData.mimeType || `image/${selectedFormat}`;
            }
          }
        }
      }

      // Process the image data (works for both APIs)
      if (imageData) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const randomId = Math.random().toString(36).substring(2, 8);
        const imageId = `${timestamp}-${randomId}`;
        const fileName = `generated-${imageId}.${selectedFormat}`;
        const filePath = path.join(imagesDir, fileName);

        const imageBuffer = Buffer.from(imageData, 'base64');
        
        // Validate image size
        if (imageBuffer.length > (this.config?.maxImageSize || 10 * 1024 * 1024)) {
          Logger.warn("Generated image exceeds size limit", { size: imageBuffer.length });
        }

        await fs.writeFile(filePath, imageBuffer);
        savedFiles.push(filePath);
        this.lastImagePath = filePath;

        // Save metadata
        const metadata: ImageMetadata = {
          id: imageId,
          filePath,
          uri: `img://image/${imageId}`,
          prompt,
          type: "generated",
          timestamp: new Date().toISOString(),
          model: selectedModel,
          format: selectedFormat,
          size: imageBuffer.length,
        };
        this.imageMetadata.set(imageId, metadata);
        await this.saveMetadata();

        content.push({
          type: "image",
          data: imageData,
          mimeType: imageMimeType,
        });
      }

      let statusText = `Image generated successfully.\n\nPrompt: "${prompt}"\nModel: ${selectedModel}\nFormat: ${selectedFormat}`;

      if (textContent) {
        statusText += `\n\nDescription: ${textContent}`;
      }

      if (savedFiles.length > 0) {
        const metadata = Array.from(this.imageMetadata.values()).find(m => m.filePath === savedFiles[0]);
        statusText += `\n\nImage saved to: ${savedFiles[0]}`;
        if (metadata) {
          statusText += `\nImage URI: ${metadata.uri}`;
          statusText += `\nImage ID: ${metadata.id}`;
        }
        statusText += `\n\nUse list_images to see all images, or get_image_metadata with the image ID for details.`;
      } else {
        statusText += `\n\nNote: No image was generated. Try running the command again.`;
      }

      content.unshift({
        type: "text",
        text: statusText,
      });

      return { content };

    } catch (error) {
      Logger.error("Failed to generate image", { error: error instanceof Error ? error.message : String(error) });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to generate image: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async editImage(request: CallToolRequest): Promise<CallToolResult> {
    if (!this.ensureConfigured()) {
      throw new McpError(ErrorCode.InvalidRequest, "Gemini API token not configured. Use configure_gemini_token first.");
    }

    if (!this.pathValidator) {
      const imagesDir = this.getImagesDirectory();
      this.pathValidator = new PathValidator(imagesDir);
    }

    const { imagePath, prompt, referenceImages } = request.params.arguments as { 
      imagePath: string;
      prompt: string;
      referenceImages?: string[];
    };

    // Validate and sanitize paths
    const validatedImagePath = this.pathValidator.validateAndSanitize(imagePath);
    
    if (!this.pathValidator.isImageFile(validatedImagePath)) {
      throw new McpError(ErrorCode.InvalidParams, `File is not a supported image format: ${imagePath}`);
    }

    // Validate reference images
    if (referenceImages && referenceImages.length > (this.config?.maxReferenceImages || 5)) {
      throw new McpError(ErrorCode.InvalidParams, `Too many reference images. Maximum: ${this.config?.maxReferenceImages || 5}`);
    }

    // Verify image file exists
    try {
      await fs.access(validatedImagePath);
    } catch {
      throw new McpError(ErrorCode.InvalidParams, `Image file not found: ${imagePath}`);
    }

    // Read the main image
    const imageBuffer = await fs.readFile(validatedImagePath);
    const imageBase64 = imageBuffer.toString('base64');
    const mimeType = this.getMimeType(validatedImagePath);

    // Prepare contents array
    const contents: any[] = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              data: imageBase64,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ];

    // Add reference images if provided
    const validatedReferenceImages: string[] = [];
    if (referenceImages && referenceImages.length > 0) {
      for (const refPath of referenceImages) {
        try {
          const validatedRefPath = this.pathValidator!.validateAndSanitize(refPath);
          if (!this.pathValidator!.isImageFile(validatedRefPath)) {
            Logger.warn("Reference image is not a supported format", { path: refPath });
            continue;
          }
          await fs.access(validatedRefPath);
          const refBuffer = await fs.readFile(validatedRefPath);
          const refBase64 = refBuffer.toString('base64');
          const refMimeType = this.getMimeType(validatedRefPath);
          
          contents[0].parts.push({
            inlineData: {
              data: refBase64,
              mimeType: refMimeType,
            },
          });
          validatedReferenceImages.push(validatedRefPath);
        } catch (error) {
          Logger.warn("Reference image not found or invalid", { path: refPath, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }

    const selectedModel = this.generationSettings.model || this.config?.model || "gemini-2.5-flash-image-preview";
    const selectedFormat = this.generationSettings.format || this.config?.defaultFormat || "png";

    Logger.info("Editing image", { model: selectedModel, format: selectedFormat, referenceImages: validatedReferenceImages.length });

    try {
      const response = await retryWithBackoff(async () => {
        return await this.genAI!.models.generateContent({
          model: selectedModel,
          contents: contents,
        });
      });

      const content: any[] = [];
      const savedFiles: string[] = [];
      let textContent = "";

      const imagesDir = this.getImagesDirectory();
      await fs.mkdir(imagesDir, { recursive: true, mode: 0o755 });

      // Find parent image metadata
      const parentMetadata = Array.from(this.imageMetadata.values()).find(m => m.filePath === validatedImagePath);

      if (response.candidates && response.candidates[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            textContent += part.text;
          }

          if (part.inlineData) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const randomId = Math.random().toString(36).substring(2, 8);
            const imageId = `${timestamp}-${randomId}`;
            const fileName = `edited-${imageId}.${selectedFormat}`;
            const filePath = path.join(imagesDir, fileName);

            if (part.inlineData.data) {
              const imageBuffer = Buffer.from(part.inlineData.data, 'base64');
              await fs.writeFile(filePath, imageBuffer);
              savedFiles.push(filePath);
              this.lastImagePath = filePath;

              // Save metadata
              const metadata: ImageMetadata = {
                id: imageId,
                filePath,
                uri: `img://image/${imageId}`,
                prompt,
                type: "edited",
                timestamp: new Date().toISOString(),
                model: selectedModel,
                format: selectedFormat,
                size: imageBuffer.length,
                referenceImages: validatedReferenceImages.length > 0 ? validatedReferenceImages : undefined,
                parentImageId: parentMetadata?.id,
              };
              this.imageMetadata.set(imageId, metadata);
              await this.saveMetadata();

              content.push({
                type: "image",
                data: part.inlineData.data,
                mimeType: part.inlineData.mimeType || `image/${selectedFormat}`,
              });
            }
          }
        }
      }

      let statusText = `Image edited successfully.\n\nOriginal: ${imagePath}\nEdit prompt: "${prompt}"`;

      if (validatedReferenceImages.length > 0) {
        statusText += `\n\nReference images used: ${validatedReferenceImages.length}`;
      }

      if (textContent) {
        statusText += `\n\nDescription: ${textContent}`;
      }

      if (savedFiles.length > 0) {
        const metadata = Array.from(this.imageMetadata.values()).find(m => m.filePath === savedFiles[0]);
        statusText += `\n\nEdited image saved to: ${savedFiles[0]}`;
        if (metadata) {
          statusText += `\nImage URI: ${metadata.uri}`;
          statusText += `\nImage ID: ${metadata.id}`;
        }
      } else {
        statusText += `\n\nNote: No edited image was generated. Try running the command again.`;
      }

      content.unshift({
        type: "text",
        text: statusText,
      });

      return { content };

    } catch (error) {
      Logger.error("Failed to edit image", { error: error instanceof Error ? error.message : String(error) });
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to edit image: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async continueEditing(request: CallToolRequest): Promise<CallToolResult> {
    if (!this.ensureConfigured()) {
      throw new McpError(ErrorCode.InvalidRequest, "Gemini API token not configured. Use configure_gemini_token first.");
    }

    if (!this.lastImagePath) {
      throw new McpError(ErrorCode.InvalidRequest, "No previous image found. Please generate or edit an image first.");
    }

    const { prompt, referenceImages } = request.params.arguments as { 
      prompt: string;
      referenceImages?: string[];
    };

    try {
      await fs.access(this.lastImagePath);
    } catch {
      throw new McpError(ErrorCode.InvalidRequest, `Last image file not found at: ${this.lastImagePath}. Please generate a new image first.`);
    }

    return await this.editImage({
      method: "tools/call",
      params: {
        name: "edit_image",
        arguments: {
          imagePath: this.lastImagePath,
          prompt: prompt,
          referenceImages: referenceImages
        }
      }
    } as CallToolRequest);
  }

  private async listImages(request: CallToolRequest): Promise<CallToolResult> {
    const args = request.params.arguments as { limit?: number; type?: "generated" | "edited" | "all" };
    const limit = args.limit || 50;
    const filterType = args.type || "all";

    let images = Array.from(this.imageMetadata.values());

    // Filter by type
    if (filterType !== "all") {
      images = images.filter(img => img.type === filterType);
    }

    // Sort by timestamp (newest first)
    images.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply limit
    images = images.slice(0, limit);

    const imageList = images.map(img => ({
      id: img.id,
      uri: img.uri,
      prompt: img.prompt,
      type: img.type,
      timestamp: img.timestamp,
      filePath: img.filePath,
      size: img.size,
      model: img.model,
      format: img.format,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${images.length} image(s):\n\n${JSON.stringify(imageList, null, 2)}`,
        },
      ],
    };
  }

  private async getImageMetadata(request: CallToolRequest): Promise<CallToolResult> {
    const { imageId } = request.params.arguments as { imageId: string };

    // Extract ID from URI if provided
    const id = imageId.startsWith("img://image/") 
      ? imageId.replace("img://image/", "")
      : imageId;

    const metadata = this.imageMetadata.get(id);
    
    if (!metadata) {
      throw new McpError(ErrorCode.InvalidParams, `Image not found: ${id}`);
    }

    // Check if file still exists
    let fileExists = false;
    let fileStats = null;
    try {
      const stats = await fs.stat(metadata.filePath);
      fileExists = true;
      fileStats = {
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
      };
    } catch {
      fileExists = false;
    }

    return {
      content: [
        {
          type: "text",
          text: `Image Metadata:\n\n${JSON.stringify({
            ...metadata,
            fileExists,
            fileStats,
          }, null, 2)}`,
        },
      ],
    };
  }

  private async deleteImage(request: CallToolRequest): Promise<CallToolResult> {
    const { imageId } = request.params.arguments as { imageId: string };

    // Extract ID from URI if provided
    const id = imageId.startsWith("img://image/") 
      ? imageId.replace("img://image/", "")
      : imageId;

    const metadata = this.imageMetadata.get(id);
    
    if (!metadata) {
      throw new McpError(ErrorCode.InvalidParams, `Image not found: ${id}`);
    }

    // Delete file
    try {
      await fs.unlink(metadata.filePath);
    } catch (error) {
      Logger.warn("Failed to delete image file", { path: metadata.filePath, error: error instanceof Error ? error.message : String(error) });
    }

    // Remove from metadata
    this.imageMetadata.delete(id);
    await this.saveMetadata();

    Logger.info("Image deleted", { id });

    return {
      content: [
        {
          type: "text",
          text: `Image deleted successfully: ${id}`,
        },
      ],
    };
  }

  private async searchImages(request: CallToolRequest): Promise<CallToolResult> {
    const args = request.params.arguments as {
      query?: string;
      startDate?: string;
      endDate?: string;
      type?: "generated" | "edited" | "all";
    };

    let images = Array.from(this.imageMetadata.values());

    // Filter by type
    if (args.type && args.type !== "all") {
      images = images.filter(img => img.type === args.type);
    }

    // Filter by date range
    if (args.startDate) {
      const start = new Date(args.startDate);
      images = images.filter(img => new Date(img.timestamp) >= start);
    }
    if (args.endDate) {
      const end = new Date(args.endDate);
      images = images.filter(img => new Date(img.timestamp) <= end);
    }

    // Filter by query (search in prompts)
    if (args.query) {
      const queryLower = args.query.toLowerCase();
      images = images.filter(img => 
        img.prompt.toLowerCase().includes(queryLower) ||
        img.id.toLowerCase().includes(queryLower)
      );
    }

    // Sort by timestamp (newest first)
    images.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const results = images.map(img => ({
      id: img.id,
      uri: img.uri,
      prompt: img.prompt,
      type: img.type,
      timestamp: img.timestamp,
      filePath: img.filePath,
    }));

    return {
      content: [
        {
          type: "text",
          text: `Found ${results.length} matching image(s):\n\n${JSON.stringify(results, null, 2)}`,
        },
      ],
    };
  }

  private async getConfigurationStatus(): Promise<CallToolResult> {
    const isConfigured = this.config !== null && this.genAI !== null;
    
    let statusText: string;
    let sourceInfo = "";
    
    if (isConfigured) {
      statusText = "Gemini API token is configured and ready to use";
      
      switch (this.configSource) {
        case 'environment':
          sourceInfo = "\nSource: Environment variable (GEMINI_API_KEY)";
          break;
        case 'config_file':
          sourceInfo = "\nSource: Local configuration file (.img-mcp-config.json)";
          break;
      }

      statusText += sourceInfo;
      statusText += `\n\nCurrent Settings:`;
      statusText += `\n- Model: ${this.generationSettings.model || this.config?.model || "gemini-2.5-flash-image-preview"}`;
      statusText += `\n- Format: ${this.generationSettings.format || this.config?.defaultFormat || "png"}`;
      statusText += `\n- Images tracked: ${this.imageMetadata.size}`;
    } else {
      statusText = "Gemini API token is not configured";
      sourceInfo = `

Configuration options (in priority order):
1. MCP client environment variables (Recommended)
2. System environment variable: GEMINI_API_KEY  
3. Use configure_gemini_token tool

For the most secure setup, add this to your MCP configuration:
"env": { "GEMINI_API_KEY": "your-api-key-here" }`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: statusText + sourceInfo,
        },
      ],
    };
  }

  private async getLastImageInfo(): Promise<CallToolResult> {
    if (!this.lastImagePath) {
      return {
        content: [
          {
            type: "text",
            text: "No previous image found. Please generate or edit an image first.",
          },
        ],
      };
    }

    try {
      await fs.access(this.lastImagePath);
      const stats = await fs.stat(this.lastImagePath);
      
      const metadata = Array.from(this.imageMetadata.values()).find(m => m.filePath === this.lastImagePath);
      
      let info = `Last Image Information:\n\nPath: ${this.lastImagePath}\nFile Size: ${Math.round(stats.size / 1024)} KB\nLast Modified: ${stats.mtime.toLocaleString()}`;
      
      if (metadata) {
        info += `\n\nMetadata:\n${JSON.stringify(metadata, null, 2)}`;
      }
      
      return {
        content: [
          {
            type: "text",
            text: info,
          },
        ],
      };
    } catch {
      return {
        content: [
          {
            type: "text",
            text: `Last Image Information:\n\nPath: ${this.lastImagePath}\nStatus: File not found\n\nThe image file may have been moved or deleted. Please generate a new image.`,
          },
        ],
      };
    }
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private isImagenModel(model: string): boolean {
    return model.startsWith("imagen-");
  }

  private ensureConfigured(): boolean {
    return this.config !== null && this.genAI !== null;
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  private getImagesDirectory(): string {
    if (this.config?.outputDirectory) {
      return this.config.outputDirectory;
    }

    const platform = os.platform();
    
    if (platform === 'win32') {
      const homeDir = os.homedir();
      return path.join(homeDir, 'Documents', 'img-mcp-images');
    } else {
      const cwd = process.cwd();
      const homeDir = os.homedir();
      
      if (cwd.startsWith('/usr/') || cwd.startsWith('/opt/') || cwd.startsWith('/var/')) {
        return path.join(homeDir, 'img-mcp-images');
      }
      
      return path.join(cwd, 'generated_imgs');
    }
  }

  private async saveConfig(): Promise<void> {
    if (this.config) {
      const configPath = path.join(process.cwd(), '.img-mcp-config.json');
      // Don't save API key to file if it came from environment
      const configToSave = this.configSource === 'environment' 
        ? { ...this.config, geminiApiKey: '[REDACTED]' }
        : this.config;
      await fs.writeFile(configPath, JSON.stringify(configToSave, null, 2));
    }
  }

  private async saveMetadata(): Promise<void> {
    const metadataPath = path.join(this.getImagesDirectory(), '.metadata.json');
    const metadataArray = Array.from(this.imageMetadata.values());
    await fs.writeFile(metadataPath, JSON.stringify(metadataArray, null, 2));
  }

  private async loadMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.getImagesDirectory(), '.metadata.json');
      const metadataData = await fs.readFile(metadataPath, 'utf-8');
      const metadataArray = JSON.parse(metadataData) as ImageMetadata[];
      
      for (const meta of metadataArray) {
        // Verify file still exists
        try {
          await fs.access(meta.filePath);
          this.imageMetadata.set(meta.id, meta);
        } catch {
          // File no longer exists, skip
          Logger.debug("Skipping metadata for missing file", { id: meta.id, path: meta.filePath });
        }
      }
      
      Logger.info("Loaded image metadata", { count: this.imageMetadata.size });
    } catch {
      // Metadata file doesn't exist, that's okay
    }
  }

  private async loadConfig(): Promise<void> {
    // Try to load from environment variable first
    const envApiKey = process.env.GEMINI_API_KEY;
    if (envApiKey) {
      try {
        this.config = ConfigSchema.parse({ geminiApiKey: envApiKey });
        this.genAI = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
        this.configSource = 'environment';
        
        // Initialize path validator
        const imagesDir = this.getImagesDirectory();
        this.pathValidator = new PathValidator(imagesDir);
        
        return;
      } catch (error) {
        Logger.warn("Invalid API key in environment", { error: error instanceof Error ? error.message : String(error) });
      }
    }
    
    // Fallback to config file
    try {
      const configPath = path.join(process.cwd(), '.img-mcp-config.json');
      const configData = await fs.readFile(configPath, 'utf-8');
      const parsedConfig = JSON.parse(configData);
      
      this.config = ConfigSchema.parse(parsedConfig);
      this.genAI = new GoogleGenAI({ apiKey: this.config.geminiApiKey });
      this.configSource = 'config_file';
      
      // Initialize path validator
      const imagesDir = this.getImagesDirectory();
      this.pathValidator = new PathValidator(imagesDir);
    } catch {
      // Config file doesn't exist or is invalid, that's okay
      this.configSource = 'not_configured';
    }
  }

  public async run(): Promise<void> {
    await this.loadConfig();
    await this.loadMetadata();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    Logger.info("MCP server started", { version: "2.0.0" });
  }
}

const server = new ImgMcp();
server.run().catch((error) => {
  Logger.error("Fatal error starting server", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
