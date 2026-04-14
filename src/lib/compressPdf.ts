import { supabase } from '@/integrations/supabase/client';

export type CompressionLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface CompressResult {
  blob: Blob;
  originalSize: number;
  compressedSize: number;
}

/**
 * Convert Blob to Base64
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Convert Base64 to Blob
 */
function base64ToBlob(base64: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'application/pdf' });
}

/**
 * Compress a PDF using PassportPDF with MRC hyper-compression
 */
export async function compressPdf(
  pdfBlob: Blob,
  filename: string
): Promise<CompressResult> {
  console.log('[Compress] Starting PDF compression with PassportPDF MRC...');

  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const originalSize = pdfBlob.size;
  
  // Convert to base64
  const pdfBase64 = await blobToBase64(pdfBlob);
  console.log('[Compress] PDF converted to base64, size:', Math.round(pdfBase64.length / 1024), 'KB');

  // Call PassportPDF Edge Function
  const { data, error } = await supabase.functions.invoke('compress-pdf-passportpdf', {
    body: {
      pdfBase64,
      filename,
    },
  });

  if (error) {
    console.error('[Compress] Edge function error:', error);
    throw new Error(error.message || 'Compression failed');
  }

  if (!data?.success) {
    console.error('[Compress] Compression failed:', data?.error);
    throw new Error(data?.error || 'Compression failed');
  }

  // Convert result back to Blob
  const compressedBlob = base64ToBlob(data.compressedBase64);
  
  console.log('[Compress] Complete. Original:', originalSize, 'Compressed:', compressedBlob.size);

  return {
    blob: compressedBlob,
    originalSize,
    compressedSize: compressedBlob.size,
  };
}

/**
 * Compress a PDF using Adobe PDF Services API
 */
export async function compressPdfAdobe(
  pdfBlob: Blob,
  filename: string,
  compressionLevel: CompressionLevel = 'MEDIUM'
): Promise<CompressResult> {
  console.log('[Adobe Compress] Starting PDF compression, level:', compressionLevel);

  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const originalSize = pdfBlob.size;
  
  // Convert to base64
  const pdfBase64 = await blobToBase64(pdfBlob);
  console.log('[Adobe Compress] PDF converted to base64, size:', Math.round(pdfBase64.length / 1024), 'KB');

  // Call Adobe Edge Function
  const { data, error } = await supabase.functions.invoke('compress-pdf', {
    body: {
      pdfBase64,
      filename,
      compressionLevel,
    },
  });

  if (error) {
    console.error('[Adobe Compress] Edge function error:', error);
    throw new Error(error.message || 'Compression failed');
  }

  if (!data?.success) {
    console.error('[Adobe Compress] Compression failed:', data?.error);
    throw new Error(data?.error || 'Compression failed');
  }

  // Convert result back to Blob
  const compressedBlob = base64ToBlob(data.compressedBase64);
  
  console.log('[Adobe Compress] Complete. Original:', originalSize, 'Compressed:', compressedBlob.size);

  return {
    blob: compressedBlob,
    originalSize,
    compressedSize: compressedBlob.size,
  };
}

/**
 * Compress a PDF using iLovePDF API
 */
export async function compressPdfILovePdf(
  pdfBlob: Blob,
  filename: string
): Promise<CompressResult> {
  console.log('[iLovePDF Compress] Starting PDF compression...');

  if (!supabase) {
    throw new Error('Backend not configured');
  }

  const originalSize = pdfBlob.size;
  
  // Convert to base64
  const pdfBase64 = await blobToBase64(pdfBlob);
  console.log('[iLovePDF Compress] PDF converted to base64, size:', Math.round(pdfBase64.length / 1024), 'KB');

  // Call iLovePDF Edge Function
  const { data, error } = await supabase.functions.invoke('compress-pdf-ilovepdf', {
    body: {
      pdfBase64,
      filename,
    },
  });

  if (error) {
    console.error('[iLovePDF Compress] Edge function error:', error);
    throw new Error(error.message || 'Compression failed');
  }

  if (!data?.success) {
    console.error('[iLovePDF Compress] Compression failed:', data?.error);
    throw new Error(data?.error || 'Compression failed');
  }

  // Convert result back to Blob
  const compressedBlob = base64ToBlob(data.compressedBase64);
  
  console.log('[iLovePDF Compress] Complete. Original:', originalSize, 'Compressed:', compressedBlob.size);

  return {
    blob: compressedBlob,
    originalSize,
    compressedSize: compressedBlob.size,
  };
}
