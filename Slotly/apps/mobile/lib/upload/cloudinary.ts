// apps/mobile/lib/upload/cloudinary.ts
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

// Types for better type safety
export interface CloudinaryUploadOptions {
  folder?: string;
  transformation?: string;
  tags?: string[];
  context?: Record<string, string>;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw';
  quality?: 'auto' | number;
  format?: string;
  eager?: string[];
  onProgress?: (progress: number) => void;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface CloudinaryResponse {
  public_id: string;
  version: number;
  signature: string;
  width?: number;
  height?: number;
  format: string;
  resource_type: string;
  created_at: string;
  tags: string[];
  bytes: number;
  type: string;
  etag: string;
  placeholder?: boolean;
  url: string;
  secure_url: string;
  access_mode: string;
  original_filename: string;
}

export class CloudinaryError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'CloudinaryError';
  }
}

// Enhanced MIME type detection with more formats
function guessMimeType(uri: string): string {
  const ext = (uri.split(".").pop() || "").toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    // Images
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'avif': 'image/avif',
    
    // Videos
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'webm': 'video/webm',
    'm4v': 'video/x-m4v',
    'flv': 'video/x-flv',
    'wmv': 'video/x-ms-wmv',
    '3gp': 'video/3gpp',
    
    // Audio
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'aac': 'audio/aac',
    'm4a': 'audio/mp4',
    'flac': 'audio/flac',
    'wma': 'audio/x-ms-wma',
    
    // Documents
    'pdf': 'application/pdf',
    'doc': 'application/msword',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'xls': 'application/vnd.ms-excel',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'ppt': 'application/vnd.ms-powerpoint',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'txt': 'text/plain',
    'rtf': 'application/rtf',
    
    // Archives
    'zip': 'application/zip',
    'rar': 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    'tar': 'application/x-tar',
    'gz': 'application/gzip',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}

// Get resource type based on MIME type
function getResourceType(mimeType: string): 'image' | 'video' | 'raw' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}

// Validate file before upload (web-safe)
async function validateFile(uri: string): Promise<{ size: number; exists: boolean }> {
  try {
    // On web, ImagePicker returns blob:/data: URIs which expo-file-system cannot stat
    if (Platform.OS === "web") {
      const res = await fetch(uri);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return { size: blob.size || 0, exists: true };
    }
    
    // Native platforms
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new CloudinaryError('File does not exist', 'FILE_NOT_FOUND');
    }
    return { size: fileInfo.size || 0, exists: fileInfo.exists };
  } catch (error) {
    throw new CloudinaryError(
      'Failed to validate file',
      'VALIDATION_ERROR',
      undefined,
      error
    );
  }
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Generate a unique filename
function generateFilename(originalUri: string, mimeType: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = originalUri.split('.').pop()?.toLowerCase() || 
    (mimeType.includes('image') ? 'jpg' : 'bin');
  return `upload_${timestamp}_${random}.${ext}`;
}

// Build form data for native upload (uri-based)
function buildFormDataNative(
  uri: string, 
  filename: string, 
  mimeType: string, 
  options: CloudinaryUploadOptions
): FormData {
  const form = new FormData();
  
  form.append("file", {
    uri,
    name: filename,
    type: mimeType,
  } as any);
  
  form.append("upload_preset", process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
  
  if (options.folder) form.append("folder", options.folder);
  if (options.publicId) form.append("public_id", options.publicId);
  if (options.tags?.length) form.append("tags", options.tags.join(","));
  if (options.transformation) form.append("transformation", options.transformation);
  if (options.quality) form.append("quality", String(options.quality));
  if (options.format) form.append("format", options.format);
  if (options.eager?.length) form.append("eager", options.eager.join("|"));
  
  if (options.context) {
    const contextString = Object.entries(options.context)
      .map(([key, value]) => `${key}=${value}`)
      .join("|");
    form.append("context", contextString);
  }
  
  return form;
}

// Build form data for web upload (blob-based)
function buildFormDataWeb(
  blob: Blob,
  filename: string,
  options: CloudinaryUploadOptions
): FormData {
  const form = new FormData();
  
  // Use File constructor for web
  form.append("file", new File([blob], filename, { type: blob.type }));
  form.append("upload_preset", process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!);
  
  if (options.folder) form.append("folder", options.folder);
  if (options.publicId) form.append("public_id", options.publicId);
  if (options.tags?.length) form.append("tags", options.tags.join(","));
  if (options.transformation) form.append("transformation", options.transformation);
  if (options.quality) form.append("quality", String(options.quality));
  if (options.format) form.append("format", options.format);
  if (options.eager?.length) form.append("eager", options.eager.join("|"));
  
  if (options.context) {
    const contextString = Object.entries(options.context)
      .map(([key, value]) => `${key}=${value}`)
      .join("|");
    form.append("context", contextString);
  }
  
  return form;
}

// Main upload function with retries (web + native)
async function uploadWithRetry(
  uri: string,
  options: CloudinaryUploadOptions,
  attempt = 1
): Promise<CloudinaryResponse> {
  const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const preset = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  
  if (!cloud || !preset) {
    throw new CloudinaryError(
      'Cloudinary configuration missing. Please set EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME and EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET',
      'CONFIG_MISSING'
    );
  }

  const maxRetries = options.maxRetries || 3;
  const timeout = options.timeout || 30000;
  const retryDelay = options.retryDelay || 1000;

  try {
    // Validate file (works on web + native)
    await validateFile(uri);
    
    let mimeType = guessMimeType(uri);
    let filename = generateFilename(uri, mimeType);
    let resourceType: 'image' | 'video' | 'raw';

    // Web upload path
    if (Platform.OS === "web") {
      const res = await fetch(uri);
      const blob = await res.blob();
      mimeType = blob.type || mimeType;
      filename = generateFilename(uri, mimeType);
      resourceType = options.resourceType || getResourceType(mimeType);
      
      const form = buildFormDataWeb(blob, filename, options);
      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(uploadUrl, {
          method: "POST",
          body: form,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const result = await response.json();
        if (!response.ok) {
          const errorMessage = result?.error?.message || `HTTP ${response.status}: Upload failed`;
          throw new CloudinaryError(
            errorMessage,
            result?.error?.code || 'UPLOAD_FAILED',
            response.status,
            result
          );
        }
        options.onProgress?.(100);
        return result as CloudinaryResponse;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    }

    // Native upload path
    resourceType = options.resourceType || getResourceType(mimeType);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`;

    // Use FileSystem.createUploadTask for progress on native
    const useProgress = typeof options.onProgress === "function";

    if (useProgress) {
      const uploadOptions: FileSystem.FileSystemUploadOptions = {
        httpMethod: "POST",
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: "file",
        parameters: {
          upload_preset: preset,
          folder: options.folder ?? "slotly",
          ...(options.publicId && { public_id: options.publicId }),
          ...(options.tags?.length ? { tags: options.tags.join(",") } : {}),
          ...(options.transformation && { transformation: options.transformation }),
          ...(options.format && { format: options.format }),
          ...(options.quality && { quality: String(options.quality) }),
          ...(options.eager?.length ? { eager: options.eager.join("|") } : {}),
          ...(options.context &&
            { context: Object.entries(options.context).map(([k, v]) => `${k}=${v}`).join("|") }),
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const task = FileSystem.createUploadTask(
          uploadUrl,
          uri,
          uploadOptions,
          (progress) => {
            const pct = progress.totalBytesExpectedToSend
              ? Math.round((progress.totalBytesSent / progress.totalBytesExpectedToSend) * 100)
              : 0;
            options.onProgress?.(pct);
          }
        );

        const res = await task.uploadAsync();
        clearTimeout(timeoutId);

        if (!res) {
          throw new CloudinaryError('Upload task returned null result', 'UPLOAD_FAILED');
        }

        const status = Number(res.status);
        const json = res.body ? JSON.parse(res.body) : {};

        if (status < 200 || status >= 300) {
          const msg = json?.error?.message || `HTTP ${status}: Upload failed`;
          throw new CloudinaryError(msg, json?.error?.code || "UPLOAD_FAILED", status, json);
        }

        options.onProgress?.(100);
        return json as CloudinaryResponse;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    } else {
      // Native fetch path (no progress available)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const form = buildFormDataNative(uri, filename, mimeType, { ...options, resourceType });
        const response = await fetch(uploadUrl, { 
          method: "POST", 
          body: form, 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);

        const json = await response.json();
        if (!response.ok) {
          const msg = json?.error?.message || `HTTP ${response.status}: Upload failed`;
          throw new CloudinaryError(msg, json?.error?.code || "UPLOAD_FAILED", response.status, json);
        }

        options.onProgress?.(100);
        return json as CloudinaryResponse;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    }
    
  } catch (error: any) {
    // Retry logic
    if (attempt < maxRetries) {
      const isRetryableError = 
        (error instanceof CloudinaryError && 
         (error.statusCode === undefined || error.statusCode >= 500 || error.statusCode === 408)) ||
        error instanceof TypeError || // Network error
        (error as any)?.name === 'AbortError'; // Timeout
      
      if (isRetryableError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Upload attempt ${attempt} failed, retrying in ${retryDelay}ms...`, errorMessage);
        await sleep(retryDelay * attempt); // Exponential backoff
        return uploadWithRetry(uri, options, attempt + 1);
      }
    }
    
    // Re-throw the error if not retryable or max retries reached
    if (error instanceof CloudinaryError) {
      throw error;
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new CloudinaryError(
      `Upload failed after ${attempt} attempts: ${errorMessage}`,
      'UPLOAD_FAILED',
      undefined,
      error
    );
  }
}

// Main upload function (backwards compatible)
export async function uploadToCloudinary(
  uri: string, 
  folder = "slotly"
): Promise<string> {
  const result = await uploadToCloudinaryAdvanced(uri, { folder });
  return result.secure_url;
}

// Advanced upload function with full options
export async function uploadToCloudinaryAdvanced(
  uri: string,
  options: CloudinaryUploadOptions = {}
): Promise<CloudinaryResponse> {
  const defaultOptions: CloudinaryUploadOptions = {
    folder: "slotly",
    maxRetries: 3,
    retryDelay: 1000,
    timeout: 30000,
    ...options
  };
  
  return uploadWithRetry(uri, defaultOptions);
}

// Batch upload function
export async function uploadMultipleToCloudinary(
  uris: string[],
  options: CloudinaryUploadOptions & { 
    onBatchProgress?: (completed: number, total: number) => void;
    concurrency?: number;
  } = {}
): Promise<CloudinaryResponse[]> {
  const { onBatchProgress, concurrency = 3, ...uploadOptions } = options;
  const results: CloudinaryResponse[] = [];
  const errors: { uri: string; error: Error }[] = [];
  
  // Process uploads in batches to avoid overwhelming the API
  for (let i = 0; i < uris.length; i += concurrency) {
    const batch = uris.slice(i, i + concurrency);
    
    const batchPromises = batch.map(async (uri) => {
      try {
        return await uploadToCloudinaryAdvanced(uri, uploadOptions);
      } catch (error) {
        errors.push({ uri, error: error as Error });
        throw error;
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      }
    });
    
    onBatchProgress?.(results.length, uris.length);
  }
  
  if (errors.length > 0) {
    console.warn(`${errors.length} uploads failed:`, errors);
  }
  
  return results;
}

// Utility function to get optimized image URL
export function getOptimizedImageUrl(
  publicId: string,
  options: {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'scale' | 'crop' | 'thumb';
    quality?: 'auto' | number;
    format?: 'auto' | 'webp' | 'jpg' | 'png';
    blur?: number;
    brightness?: number;
    contrast?: number;
    saturation?: number;
  } = {}
): string {
  const cloud = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!cloud) throw new Error('EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME is required');
  
  const transformations: string[] = [];
  
  if (options.width || options.height) {
    const crop = options.crop || 'fill';
    transformations.push(`c_${crop}`);
    if (options.width) transformations.push(`w_${options.width}`);
    if (options.height) transformations.push(`h_${options.height}`);
  }
  
  if (options.quality) transformations.push(`q_${options.quality}`);
  if (options.format) transformations.push(`f_${options.format}`);
  if (options.blur) transformations.push(`e_blur:${options.blur}`);
  if (options.brightness) transformations.push(`e_brightness:${options.brightness}`);
  if (options.contrast) transformations.push(`e_contrast:${options.contrast}`);
  if (options.saturation) transformations.push(`e_saturation:${options.saturation}`);
  
  const transformationString = transformations.length > 0 ? `${transformations.join(',')}` : '';
  
  return `https://res.cloudinary.com/${cloud}/image/upload${transformationString ? `/${transformationString}` : ''}/${publicId}`;
}