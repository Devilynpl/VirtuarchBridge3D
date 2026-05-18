const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const projectDir = path.join(__dirname, '..');
const buildPath = path.join(projectDir, 'build');

async function main() {
    if (!fs.existsSync(buildPath)) {
        fs.mkdirSync(buildPath, { recursive: true });
    }

    // 1. Sidebar BMP (164x314) from splash.png
    console.log('Creating installerSidebar.bmp (164x314)...');
    await sharp(path.join(projectDir, 'Loader', 'splash.png'))
        .resize(164, 314, { fit: 'cover', position: 'center' })
        .toFile(path.join(buildPath, 'installerSidebar.bmp'));
    console.log('  Done');

    // 2. Header BMP (150x57)
    console.log('Creating installerHeader.bmp (150x57)...');
    await sharp(path.join(projectDir, 'Loader', 'splash.png'))
        .resize(150, 57, { fit: 'cover', position: 'top' })
        .toFile(path.join(buildPath, 'installerHeader.bmp'));
    console.log('  Done');

    // 3. Icon PNG (256x256) for electron-builder
    console.log('Creating icon.png (256x256)...');
    await sharp(path.join(projectDir, 'public', 'logo.png'))
        .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .toFormat('png')
        .toFile(path.join(buildPath, 'icon.png'));
    console.log('  Done');

    // 4. Create ICO file manually (PNG-encoded ICO)
    console.log('Creating icon.ico...');
    const sizes = [256, 128, 64, 48, 32, 16];
    const pngBuffers = [];

    for (const size of sizes) {
        const buf = await sharp(path.join(projectDir, 'public', 'logo.png'))
            .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .toFormat('png')
            .toBuffer();
        pngBuffers.push({ size, buffer: buf });
    }

    // ICO format: header (6 bytes) + entries (16 bytes each) + image data
    const numImages = pngBuffers.length;
    const headerSize = 6;
    const entrySize = 16;
    const dataOffset = headerSize + (entrySize * numImages);

    let currentOffset = dataOffset;
    const entries = [];

    for (const { size, buffer } of pngBuffers) {
        entries.push({
            width: size >= 256 ? 0 : size,
            height: size >= 256 ? 0 : size,
            dataSize: buffer.length,
            offset: currentOffset
        });
        currentOffset += buffer.length;
    }

    const totalSize = currentOffset;
    const ico = Buffer.alloc(totalSize);

    // Header
    ico.writeUInt16LE(0, 0);      // Reserved
    ico.writeUInt16LE(1, 2);      // Type: ICO
    ico.writeUInt16LE(numImages, 4); // Count

    // Entries
    for (let i = 0; i < entries.length; i++) {
        const off = headerSize + (i * entrySize);
        ico.writeUInt8(entries[i].width, off);
        ico.writeUInt8(entries[i].height, off + 1);
        ico.writeUInt8(0, off + 2);   // Color palette
        ico.writeUInt8(0, off + 3);   // Reserved
        ico.writeUInt16LE(1, off + 4); // Color planes
        ico.writeUInt16LE(32, off + 6); // Bits per pixel
        ico.writeUInt32LE(entries[i].dataSize, off + 8);
        ico.writeUInt32LE(entries[i].offset, off + 12);
    }

    // Image data
    for (let i = 0; i < pngBuffers.length; i++) {
        pngBuffers[i].buffer.copy(ico, entries[i].offset);
    }

    fs.writeFileSync(path.join(buildPath, 'icon.ico'), ico);
    console.log('  Done');

    console.log('\nAll installer assets created in build/');
}

main().catch(err => { console.error('Error:', err); process.exit(1); });
