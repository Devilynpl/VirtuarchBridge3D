/**
 * Map Generation Utilities
 * Provides canvas-based image processing for Normal, AO, and Displacement maps.
 */

export async function generateNormalMap(image: HTMLImageElement, strength: number = 2.0): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const width = image.width || 1024;
    const height = image.height || 1024;

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);

    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Temp array for grayscale values
    const grayscale = new Float32Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0;
        grayscale[i / 4] = luma;
    }

    const outputData = new Uint8ClampedArray(data.length);

    // Apply Sobel filter
    const dz = 1.0 / Math.max(0.1, strength);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let dX = 0;
            let dY = 0;

            if (y === 0 || y === height - 1 || x === 0 || x === width - 1) {
                // Border pixels face straight up to avoid expensive bounds checking
                dX = 0;
                dY = 0;
            } else {
                const idx = y * width + x;
                const tl = grayscale[idx - width - 1];
                const tm = grayscale[idx - width];
                const tr = grayscale[idx - width + 1];
                const l = grayscale[idx - 1];
                const r = grayscale[idx + 1];
                const bl = grayscale[idx + width - 1];
                const bm = grayscale[idx + width];
                const br = grayscale[idx + width + 1];

                dX = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
                dY = (bl + 2.0 * bm + br) - (tl + 2.0 * tm + tr);
            }

            const length = Math.sqrt(dX * dX + dY * dY + dz * dz);

            const outIdx = (y * width + x) * 4;
            // Uint8ClampedArray automatically clamps to 0-255
            outputData[outIdx] = ((dX / length) * 0.5 + 0.5) * 255.0; // R
            outputData[outIdx + 1] = ((dY / length) * 0.5 + 0.5) * 255.0; // G
            outputData[outIdx + 2] = ((dz / length) * 0.5 + 0.5) * 255.0; // B
            outputData[outIdx + 3] = data[outIdx + 3];                    // A
        }
    }

    const newImageData = new ImageData(outputData, width, height);
    ctx.putImageData(newImageData, 0, 0);

    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

export async function invertNormalMap(image: HTMLImageElement): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    // Invert the Y (green) channel to flip between DirectX <-> OpenGL normal map formats
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i + 1] = 255 - pixels[i + 1]; // Invert Green channel
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

export async function generateAOMap(image: HTMLImageElement, intensity: number = 1.5, brightness: number = 1.0): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const gray = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
        const val = Math.min(255, Math.max(0, Math.pow(gray / 255, intensity) * 255 * brightness));
        pixels[i] = val;
        pixels[i + 1] = val;
        pixels[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

export async function generateRoughnessMap(image: HTMLImageElement, contrast: number = 0.9, brightness: number = 1.0): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const luma = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
        const val = Math.min(255, Math.max(0, Math.pow(luma, contrast) * 255 * brightness));
        pixels[i] = val;
        pixels[i + 1] = val;
        pixels[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

export async function generateDisplacementMap(image: HTMLImageElement, strength: number = 1.0, blur: number = 1.0): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const nx = (pixels[i] / 127.5) - 1;
        const ny = (pixels[i + 1] / 127.5) - 1;

        const disp = (nx * nx + ny * ny) * strength * 127 + 128;
        const val = Math.min(255, Math.max(0, disp));

        pixels[i] = val;
        pixels[i + 1] = val;
        pixels[i + 2] = val;
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

export async function generateSpecularMap(image: HTMLImageElement, contrast: number = 1.5, brightness: number = 1.0): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = image.width;
    canvas.height = image.height;
    ctx.drawImage(image, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imgData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const rough = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3 / 255;
        const spec = Math.min(255, Math.max(0, Math.pow(1.0 - rough, contrast) * 255 * brightness));
        pixels[i] = spec;
        pixels[i + 1] = spec;
        pixels[i + 2] = spec;
    }

    ctx.putImageData(imgData, 0, 0);
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

/**
 * Packs multiple grayscale sources into a single ORD map
 */
export async function packORDMap(aoBlob?: Blob, roughnessBlob?: Blob, displacementBlob?: Blob): Promise<Blob> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Load images
    const [aoImg, roughImg, dispImg] = await Promise.all([
        aoBlob ? blobToImage(aoBlob) : null,
        roughnessBlob ? blobToImage(roughnessBlob) : null,
        displacementBlob ? blobToImage(displacementBlob) : null
    ]);

    const w = aoImg?.width || roughImg?.width || dispImg?.width || 1024;
    const h = aoImg?.height || roughImg?.height || dispImg?.height || 1024;

    canvas.width = w;
    canvas.height = h;

    const aoData = aoImg ? getImageData(aoImg, w, h) : null;
    const roughData = roughImg ? getImageData(roughImg, w, h) : null;
    const dispData = dispImg ? getImageData(dispImg, w, h) : null;

    const output = ctx.createImageData(w, h);
    const pix = output.data;

    for (let i = 0; i < pix.length; i += 4) {
        pix[i] = aoData ? aoData.data[i] : 255;      // R: AO
        pix[i + 1] = roughData ? roughData.data[i] : 128; // G: Roughness
        pix[i + 2] = dispData ? dispData.data[i] : 0;   // B: Displacement
        pix[i + 3] = 255;
    }

    ctx.putImageData(output, 0, 0);
    return new Promise(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
}

function getImageData(img: HTMLImageElement, w: number, h: number): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
}
