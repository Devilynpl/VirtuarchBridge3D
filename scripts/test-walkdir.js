const fs = require('fs/promises');
const path = require('path');

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function walkDir(dir, fileList = [], state = { count: 0 }) {
    try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        for (const file of files) {
            // Yield every 500 files to prevent event loop blocking
            if (++state.count % 500 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            if (file.isDirectory()) {
                if (file.name !== 'Data') {
                    await walkDir(path.join(dir, file.name), fileList, state);
                }
            } else if (file.name.endsWith('.json') && file.name !== 'assetsData.json') {
                fileList.push(path.join(dir, file.name));
            }
        }
    } catch (e) { }
    return fileList;
}

async function getLibraryPath() {
    const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
    try {
        if (await fileExists(CONFIG_PATH)) {
            const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }
    return process.env.LIBRARY_PATH || '';
}

async function main() {
    console.log('Testing speed of walkDir...');
    const libPath = await getLibraryPath();
    console.log('Library path:', libPath);
    if (!libPath) return console.log('No lib path');

    const start = Date.now();
    const files = await walkDir(libPath);
    const end = Date.now();

    console.log(`Found ${files.length} JSON files in ${end - start}ms`);
}

main();
