/**
 * Trim white borders from an image
 * Scans from edges inward to find where the document (non-white) content starts
 */

/**
 * Check if a pixel is considered "white" (background)
 * Using a threshold to account for slight variations
 */
function isWhitePixel(r: number, g: number, b: number, threshold: number = 250): boolean {
  return r >= threshold && g >= threshold && b >= threshold;
}

/**
 * Check if a row is mostly white
 */
function isWhiteRow(
  imageData: ImageData,
  y: number,
  startX: number,
  endX: number,
  whiteThreshold: number,
  tolerancePercent: number = 0.95
): boolean {
  let whiteCount = 0;
  const width = endX - startX;
  
  for (let x = startX; x < endX; x++) {
    const idx = (y * imageData.width + x) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    
    if (isWhitePixel(r, g, b, whiteThreshold)) {
      whiteCount++;
    }
  }
  
  return whiteCount / width >= tolerancePercent;
}

/**
 * Check if a column is mostly white
 */
function isWhiteColumn(
  imageData: ImageData,
  x: number,
  startY: number,
  endY: number,
  whiteThreshold: number,
  tolerancePercent: number = 0.95
): boolean {
  let whiteCount = 0;
  const height = endY - startY;
  
  for (let y = startY; y < endY; y++) {
    const idx = (y * imageData.width + x) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    
    if (isWhitePixel(r, g, b, whiteThreshold)) {
      whiteCount++;
    }
  }
  
  return whiteCount / height >= tolerancePercent;
}

/**
 * Find the boundaries of the non-white content
 */
function findContentBounds(
  imageData: ImageData,
  whiteThreshold: number = 250
): { top: number; bottom: number; left: number; right: number } {
  const { width, height } = imageData;
  
  let top = 0;
  let bottom = height;
  let left = 0;
  let right = width;
  
  // Find top edge (first non-white row)
  for (let y = 0; y < height; y++) {
    if (!isWhiteRow(imageData, y, 0, width, whiteThreshold)) {
      top = y;
      break;
    }
  }
  
  // Find bottom edge (last non-white row)
  for (let y = height - 1; y >= top; y--) {
    if (!isWhiteRow(imageData, y, 0, width, whiteThreshold)) {
      bottom = y + 1;
      break;
    }
  }
  
  // Find left edge (first non-white column)
  for (let x = 0; x < width; x++) {
    if (!isWhiteColumn(imageData, x, top, bottom, whiteThreshold)) {
      left = x;
      break;
    }
  }
  
  // Find right edge (last non-white column)
  for (let x = width - 1; x >= left; x--) {
    if (!isWhiteColumn(imageData, x, top, bottom, whiteThreshold)) {
      right = x + 1;
      break;
    }
  }
  
  return { top, bottom, left, right };
}

/**
 * Trim white borders from an image blob
 * @param imageBlob - The image with white borders
 * @returns Cropped image blob with white borders removed
 */
export async function trimWhiteBorder(imageBlob: Blob): Promise<Blob> {
  console.log('[Trim] Starting white border removal');
  
  // Load image
  const img = await createImageFromBlob(imageBlob);
  console.log('[Trim] Image loaded:', img.width, 'x', img.height);
  
  // Draw to canvas to get pixel data
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, img.width, img.height);
  
  // Find content boundaries
  const bounds = findContentBounds(imageData);
  console.log('[Trim] Content bounds:', bounds);
  
  // Calculate crop dimensions
  const cropWidth = bounds.right - bounds.left;
  const cropHeight = bounds.bottom - bounds.top;
  
  // Check if cropping would make sense (at least 10% reduction and reasonable size remaining)
  const originalArea = img.width * img.height;
  const croppedArea = cropWidth * cropHeight;
  const reductionPercent = ((originalArea - croppedArea) / originalArea) * 100;
  
  console.log('[Trim] Crop dimensions:', cropWidth, 'x', cropHeight);
  console.log('[Trim] Area reduction:', reductionPercent.toFixed(1) + '%');
  
  // If no significant white border found (less than 1% reduction), return original
  if (reductionPercent < 1 || cropWidth < 100 || cropHeight < 100) {
    console.log('[Trim] No significant white border found, returning original');
    return imageBlob;
  }
  
  // Create cropped canvas
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d')!;
  
  // Draw cropped region
  croppedCtx.drawImage(
    canvas,
    bounds.left, bounds.top, cropWidth, cropHeight,
    0, 0, cropWidth, cropHeight
  );
  
  // Convert to blob
  return new Promise((resolve) => {
    croppedCanvas.toBlob((blob) => {
      console.log('[Trim] Crop complete, new size:', blob!.size);
      resolve(blob!);
    }, 'image/jpeg', 0.95);
  });
}

/**
 * Create HTMLImageElement from Blob
 */
function createImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(blob);
  });
}
