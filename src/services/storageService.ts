import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/**
 * Automatically compress an image file or blob before upload.
 * Resizes image if width/height > maxWidthHeight and converts to JPEG blob.
 */
export async function compressImage(
  input: File | Blob,
  maxWidthHeight = 1200,
  quality = 0.8
): Promise<Blob> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidthHeight || height > maxWidthHeight) {
          if (width > height) {
            height = Math.round((height * maxWidthHeight) / width);
            width = maxWidthHeight;
          } else {
            width = Math.round((width * maxWidthHeight) / height);
            height = maxWidthHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(input);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(input);
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(input);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(input);
    reader.readAsDataURL(input);
  });
}

/**
 * Upload an image file, blob, or base64 data string to Firebase Storage
 * and return the public download URL.
 */
export async function uploadImageToStorage(
  fileOrBase64: File | Blob | string,
  folder: 'contests' | 'contestants' | 'general' = 'contests'
): Promise<string> {
  if (!fileOrBase64) return '';

  if (typeof fileOrBase64 === 'string') {
    const trimmed = fileOrBase64.trim();
    if (!trimmed) return '';
    // If it's already an http/https URL, return as is
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    // If it's base64, convert to compressed blob and upload
    if (trimmed.startsWith('data:image')) {
      try {
        const res = await fetch(trimmed);
        const blob = await res.blob();
        const compressedBlob = await compressImage(blob, 1200, 0.8);
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
        const storageRef = ref(storage, `${folder}/${fileName}`);
        const snapshot = await uploadBytes(storageRef, compressedBlob, {
          contentType: 'image/jpeg',
        });
        return await getDownloadURL(snapshot.ref);
      } catch (err) {
        console.error('Failed to upload base64 image to Storage:', err);
        throw err;
      }
    }
    return trimmed;
  }

  // It's a File or Blob
  try {
    const compressedBlob = await compressImage(fileOrBase64, 1200, 0.8);
    let fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.jpg`;
    if ('name' in fileOrBase64 && (fileOrBase64 as File).name) {
      const cleanName = (fileOrBase64 as File).name.replace(/[^a-zA-Z0-9.-]/g, '_');
      fileName = `${Date.now()}_${cleanName}`;
    }
    const storageRef = ref(storage, `${folder}/${fileName}`);
    const snapshot = await uploadBytes(storageRef, compressedBlob, {
      contentType: 'image/jpeg',
    });
    return await getDownloadURL(snapshot.ref);
  } catch (err) {
    console.error('Failed to upload image file to Storage:', err);
    throw err;
  }
}
