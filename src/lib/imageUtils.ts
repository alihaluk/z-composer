export interface ZPLImageResult {
  zplHex: string;
  totalBytes: number;
  bytesPerRow: number;
  base64: string;
  width: number;
  height: number;
}

export const imageToZPL = (file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<ZPLImageResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions keeping aspect ratio
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Draw image (white background)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Convert to monochrome and pack bits
        let hexString = '';

        // ZPL expects row padding to nearest byte
        const bytesPerRow = Math.ceil(width / 8);
        const totalBytes = bytesPerRow * height;

        for (let y = 0; y < height; y++) {
          let rowBits = '';
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];
            // Luminance
            const avg = (r + g + b) / 3;
            // Threshold (black pixel = 1, white = 0) in ZPL
            // If avg < 128 (dark), bit is 1 (print). Else 0.
            const isBlack = avg < 128;
            rowBits += isBlack ? '1' : '0';
          }
          // Pad row to byte boundary with 0 (white)
          while (rowBits.length % 8 !== 0) {
            rowBits += '0';
          }

          // Convert row bits to hex
          for (let i = 0; i < rowBits.length; i += 4) {
            const nibble = rowBits.substr(i, 4);
            const val = parseInt(nibble, 2);
            hexString += val.toString(16).toUpperCase();
          }
        }

        resolve({
          zplHex: hexString,
          totalBytes,
          bytesPerRow,
          base64: reader.result as string,
          width,
          height
        });
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
