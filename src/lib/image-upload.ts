export const MAX_PHOTO_INPUT_BYTES = 20 * 1024 * 1024;
export const MAX_COMPRESSED_PHOTO_BYTES = 500 * 1024;
export const MAX_POST_PHOTOS = 6;

export function validatePhotoFile(file: File, receipt = false): void {
  const types = receipt ? ['image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!types.includes(file.type)) throw new Error(receipt ? 'JPG, PNG, WebP 영수증 사진을 선택해 주세요.' : 'JPG, PNG, WebP, GIF 사진을 선택해 주세요.');
  if (!file.size) throw new Error('사진 파일이 비어 있어요. 다른 사진을 선택해 주세요.');
  if (file.size > MAX_PHOTO_INPUT_BYTES) throw new Error('사진은 20MB 이하로 선택해 주세요.');
}

type ImageFormat = 'image/webp' | 'image/jpeg';
/** Safari returns PNG when WebP encoding is unavailable, ignoring the quality argument. */
export async function encodeCanvasImage(canvas: HTMLCanvasElement, quality: number, format: ImageFormat = 'image/webp'): Promise<Blob> {
  const encode = (type: ImageFormat) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
  const preferred = await encode(format);
  if (preferred?.type === format) return preferred;
  const jpeg = await encode('image/jpeg');
  if (!jpeg || jpeg.type !== 'image/jpeg') throw new Error('사진을 처리하지 못했어요. 다른 사진을 선택해 주세요.');
  return jpeg;
}

export const prepareReceipt = (file: File) => prepareCompressedImage(file, true);
export const preparePostPhoto = (file: File) => prepareCompressedImage(file, false);

async function prepareCompressedImage(file: File, receipt: boolean): Promise<{ fileName: string; imageURL: string }> {
  validatePhotoFile(file, receipt);
  const image = await createImageBitmap(file).catch(() => { throw new Error('사진을 읽지 못했어요. 다른 사진을 선택해 주세요.'); });
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리하지 못했어요.');
    const initialScale = receipt ? Math.min(1, 1200 / image.width, 2400 / image.height) : Math.min(1, 2048 / image.width, 2048 / image.height);
    let format: ImageFormat = 'image/webp';
    for (let attempt = 0; attempt < 15; attempt++) {
      const scale = initialScale * .8 ** Math.floor(attempt / 3);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await encodeCanvasImage(canvas, [.86, .72, .58][attempt % 3], format);
      format = blob.type as ImageFormat;
      if (blob.size > MAX_COMPRESSED_PHOTO_BYTES) continue;
      const imageURL = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('사진을 읽지 못했어요.'));
        reader.readAsDataURL(blob);
      });
      return { fileName: file.name.slice(0, 200), imageURL };
    }
    throw new Error(receipt ? '영수증 사진을 저장할 크기로 줄이지 못했어요. 다른 사진을 선택해 주세요.' : '사진을 저장할 크기로 줄이지 못했어요. 다른 사진을 선택해 주세요.');
  } finally {
    image.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
