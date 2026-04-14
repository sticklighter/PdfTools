import { supabase } from '@/integrations/supabase/client';
import { trimWhiteBorder } from '@/lib/trimWhiteBorder';

export interface ScanOptions {
  enhance?: boolean;
}

/**
 * Convert File to Base64
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert Base64 to Blob
 */
function base64ToBlob(base64: string, mimeType: string = 'image/jpeg'): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

/**
 * Process document:
 * 1. Cloudinary: Background cleanup, enhance, sharpen
 * 2. Trim: Remove white borders
 */
export async function scanDocument(file: File, _options: ScanOptions = {}): Promise<Blob> {
  console.log('[Scanner] Processing document:', file.name);

  if (!supabase) {
    throw new Error('Backend not configured. Please enable Cloud Backend.');
  }

  // Convert image to base64
  const base64Image = await fileToBase64(file);
  console.log('[Scanner] Image converted to base64, size:', Math.round(base64Image.length / 1024), 'KB');

  // Step 1: Send to Cloudinary for background cleanup
  console.log('[Scanner] Step 1: Cloudinary background cleanup...');
  const { data, error } = await supabase.functions.invoke('process-document-cloudinary', {
    body: {
      image: base64Image,
      filename: file.name,
    },
  });

  if (error) {
    console.error('[Scanner] Edge function error:', error);
    throw new Error(error.message || 'Failed to process document');
  }

  if (!data?.success) {
    console.error('[Scanner] Processing failed:', data?.error);
    throw new Error(data?.error || 'Failed to process document');
  }

  console.log('[Scanner] Cloudinary cleanup complete, format:', data.format);

  // Convert Cloudinary result to Blob
  const mimeType = data.format === 'png' ? 'image/png' : 'image/jpeg';
  const cleanedBlob = base64ToBlob(data.image, mimeType);
  console.log('[Scanner] Cleaned image size:', Math.round(cleanedBlob.size / 1024), 'KB');

  // Step 2: Trim white borders
  console.log('[Scanner] Step 2: Trimming white borders...');
  const trimmedBlob = await trimWhiteBorder(cleanedBlob);
  console.log('[Scanner] Final result size:', Math.round(trimmedBlob.size / 1024), 'KB');

  return trimmedBlob;
}

/**
 * No longer need to wait for OpenCV
 */
export function waitForOpenCV(): Promise<void> {
  return Promise.resolve();
}
