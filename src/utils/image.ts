const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

type OptimizeImageOptions = {
  maxWidth: number;
  maxHeight: number;
  quality?: number;
};

function canOptimizeImage(file: File): boolean {
  if (typeof window === 'undefined') return false;
  if (!IMAGE_MIME_TYPES.has(file.type)) return false;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return false;
  return typeof document !== 'undefined';
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for optimization.'));
    };
    image.src = objectUrl;
  });
}

function getOutputMimeType(file: File): string {
  if (file.type === 'image/png') return 'image/webp';
  return 'image/jpeg';
}

function getOutputFileName(file: File, mimeType: string): string {
  const nextExtension = mimeType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
  return `${baseName}.${nextExtension}`;
}

export async function optimizeImageFile(file: File, options: OptimizeImageOptions): Promise<File> {
  if (!canOptimizeImage(file)) return file;

  try {
    const image = await loadImageFromFile(file);
    const widthRatio = options.maxWidth / image.width;
    const heightRatio = options.maxHeight / image.height;
    const scale = Math.min(1, widthRatio, heightRatio);
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));

    if (targetWidth === image.width && targetHeight === image.height && file.size < 350 * 1024) {
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return file;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const mimeType = getOutputMimeType(file);
    const quality = options.quality ?? 0.82;
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    if (!blob) return file;
    if (blob.size >= file.size * 0.95 && targetWidth === image.width && targetHeight === image.height) {
      return file;
    }

    return new File([blob], getOutputFileName(file, mimeType), {
      type: mimeType,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function getUploadOptimizationOptions(folder: string): OptimizeImageOptions {
  if (folder.includes('profile/avatar')) {
    return { maxWidth: 512, maxHeight: 512, quality: 0.86 };
  }
  if (folder.includes('profile/cover')) {
    return { maxWidth: 1600, maxHeight: 900, quality: 0.82 };
  }
  if (folder.includes('profile/portfolio')) {
    return { maxWidth: 1400, maxHeight: 1400, quality: 0.82 };
  }
  if (folder.includes('posts')) {
    return { maxWidth: 1600, maxHeight: 1600, quality: 0.82 };
  }
  if (folder.includes('market')) {
    return { maxWidth: 1200, maxHeight: 1200, quality: 0.76 };
  }
  return { maxWidth: 1280, maxHeight: 1280, quality: 0.8 };
}
