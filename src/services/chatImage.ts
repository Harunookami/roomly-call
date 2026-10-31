import { MAX_IMAGE_BYTES } from "../types/Chat";

const MAX_DIMENSION = 1600;
const QUALITY_STEPS = [0.85, 0.7, 0.5, 0.35];

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality)
  );
}

// Reduz a imagem antes do envio. Redesenhar também remove metadados, como a
// localização gravada em fotos de celular. GIFs seguem iguais para manter a animação.
export async function prepareChatImage(file: File) {
  if (file.type === "image/gif") {
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error("image-too-large");
    }

    return file.arrayBuffer();
  }

  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("invalid-image");
  });
  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const canvas = document.createElement("canvas");

  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("invalid-image");
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // O JPEG cobre navegadores que não geram WebP e por isso devolvem um PNG pesado.
  for (const type of ["image/webp", "image/jpeg"]) {
    for (const quality of QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, type, quality);

      if (blob && blob.size <= MAX_IMAGE_BYTES) {
        return blob.arrayBuffer();
      }
    }
  }

  throw new Error("image-too-large");
}
