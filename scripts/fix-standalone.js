const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const standalone = path.join(root, '.next', 'standalone');

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (let entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            copyDir(srcPath, destPath);
        } else if (entry.isSymbolicLink()) {
            // Convert symlink to real file for Windows installer stability
            const realPath = fs.realpathSync(srcPath);
            if (fs.lstatSync(realPath).isDirectory()) {
                copyDir(realPath, destPath);
            } else {
                fs.copyFileSync(realPath, destPath);
            }
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

console.log('--- Fixing Next.js Standalone for Electron (Pure Node) ---');

if (!fs.existsSync(standalone)) {
    console.error('❌ Error: .next/standalone not found.');
    process.exit(1);
}

// 1. Copy Static Assets
console.log('Injecting .next/static...');
copyDir(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'));

// 2. Copy Public Folder
console.log('Injecting public assets...');
copyDir(path.join(root, 'public'), path.join(standalone, 'public'));

// 3. Copy .env file if it exists
if (fs.existsSync(path.join(root, '.env'))) {
    console.log('Injecting .env...');
    fs.copyFileSync(path.join(root, '.env'), path.join(standalone, '.env'));
}

// 4. Copy Prisma if it exists
const prismaDest = path.join(standalone, 'node_modules', '@prisma');
if (fs.existsSync(path.join(root, 'node_modules', '@prisma')) && !fs.existsSync(prismaDest)) {
    console.log('Injecting @prisma into standalone node_modules...');
    copyDir(path.join(root, 'node_modules', '@prisma'), prismaDest);
}
const queryEngineDest = path.join(standalone, 'node_modules', '.prisma');
if (fs.existsSync(path.join(root, 'node_modules', '.prisma')) && !fs.existsSync(queryEngineDest)) {
    console.log('Injecting .prisma into standalone node_modules...');
    copyDir(path.join(root, 'node_modules', '.prisma'), queryEngineDest);
}

console.log('✅ Standalone fixed and ready.');
