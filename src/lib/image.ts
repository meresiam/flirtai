// Comprime + corta quadrado (center crop) + converte pra data URL JPEG.
// Roda 100% no client; o resultado vai direto pro avatar_url do contato.

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB no upload bruto

export interface ResizeOptions {
  maxDim?: number;
  quality?: number;
}

export async function resizeImageToDataUrl(
  file: File,
  options: ResizeOptions = {},
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Arquivo precisa ser uma imagem.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Imagem grande demais (máx. 10MB).");
  }

  const maxDim = options.maxDim ?? 400;
  const quality = options.quality ?? 0.75;

  const sourceDataUrl = await readFileAsDataUrl(file);
  const img = await loadImage(sourceDataUrl);

  // Center crop pro quadrado, depois escala pra maxDim.
  const sourceSize = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - sourceSize) / 2;
  const sy = (img.naturalHeight - sourceSize) / 2;
  const targetSize = Math.min(sourceSize, maxDim);

  const canvas = document.createElement("canvas");
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, targetSize, targetSize);
  return canvas.toDataURL("image/jpeg", quality);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Falha ao ler arquivo."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Imagem inválida ou corrompida."));
    img.src = src;
  });
}

export function isDataUrl(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("data:");
}

export function dataUrlSizeKB(dataUrl: string): number {
  // base64 ratio 4:3 → bytes ≈ (length - header) * 3/4
  const commaIdx = dataUrl.indexOf(",");
  const b64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  return Math.round((b64.length * 3) / 4 / 1024);
}
