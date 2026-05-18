import fs from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

async function fileExists(filePath: string): Promise<boolean> {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

export async function getLibraryPath() {
    try {
        if (await fileExists(CONFIG_PATH)) {
            const config = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf-8'));
            if (config.libraryPath) return config.libraryPath;
        }
    } catch (e) { }
    return process.env.LIBRARY_PATH || '';
}

export interface Asset {
    id: string;
    name: string;
    type: string;
    path: string;
    jsonPath: string;
    thumbnail?: string;
    tags: string[];
    categories: string[];
    maps?: { type: string; uri: string }[];
    resolutions?: string[];
    masterFile?: string; // .blend / .fbx / .obj filename for project files
}

export async function hasCache(): Promise<boolean> {
    const libraryPath = await getLibraryPath();
    if (!libraryPath) return false;
    const assetsDataPath = path.join(libraryPath, 'Data', 'assetsData.json');
    return await fileExists(assetsDataPath);
}

export async function getAssets(): Promise<Asset[]> {
    const libraryPath = await getLibraryPath();
    if (!libraryPath) {
        console.error('LIBRARY_PATH is not defined');
        return [];
    }
    try {
        const assetsDataPath = path.join(libraryPath, 'Data', 'assetsData.json');
        if (!(await fileExists(assetsDataPath))) {
            console.warn('Data/assetsData.json not found. Returning empty array for client trigger.');
            return [];
        }

        const rawData = await fs.readFile(assetsDataPath, 'utf-8');
        console.log(`[getAssets] Read assetsData.json, parsing...`);
        const assetsData = JSON.parse(rawData);
        console.log(`[getAssets] Parsed ${assetsData.length} items. Starting chunked processing.`);

        // Process assets in chunks to avoid blocking the event loop
        const chunkSize = 200;
        const assets: Asset[] = [];
        for (let i = 0; i < assetsData.length; i += chunkSize) {
            const chunk = assetsData.slice(i, i + chunkSize);
            const chunkResult = chunk.map((data: any) => {
                if (!data.path || !data.id) return null;

                const relativePath = Array.isArray(data.path) ? path.join(...data.path) : data.path;
                const assetPath = path.join(libraryPath, relativePath);

                // Thumbnail is already resolved during generateAssetsData() — read directly from JSON.
                // Never hit disk here; that would stall the event loop on 490+ assets.
                let thumbnail: string | undefined;
                if (data.thumb) {
                    const thumbRelPath = Array.isArray(data.thumb) ? path.join(...data.thumb) : data.thumb;
                    thumbnail = path.join(libraryPath, thumbRelPath);
                }

                return {
                    id: data.id,
                    name: data.name || data.id,
                    type: data.type || 'unknown',
                    path: assetPath,
                    jsonPath: path.join(assetPath, `${data.id}.json`),
                    thumbnail,
                    tags: Array.isArray(data.tags) ? data.tags : [],
                    categories: Array.isArray(data.categories) ? data.categories : [],
                    maps: Array.isArray(data.maps) ? data.maps : [],
                    resolutions: Array.isArray(data.resolutions) ? data.resolutions : [],
                    masterFile: data.masterFile || undefined
                };
            });
            assets.push(...(chunkResult as Array<Asset | null>).filter((a): a is Asset => a !== null));
            // Yield the event loop between chunks
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        return assets;
    } catch (error) {
        console.error('Error reading assets:', error);
        return [];
    }
}


async function findThumbnail(assetPath: string, assetId?: string): Promise<string | undefined> {
    try {
        // 1. Check for *_Preview.* files directly in asset folder
        const dirFiles = await fs.readdir(assetPath);
        const previewFile = dirFiles.find(f => {
            const fl = f.toLowerCase();
            return (fl.includes('preview') || fl.includes('thumb')) && fl.match(/\.(jpg|jpeg|png|webp)$/i);
        });
        if (previewFile) return path.join(assetPath, previewFile);

        // 2. Check for asset-specific thumbnail by ID
        if (assetId) {
            const idThumb = dirFiles.find(f => {
                const fl = f.toLowerCase();
                return fl.startsWith(assetId.toLowerCase()) && fl.includes('grid') && fl.match(/\.(jpg|jpeg|png)$/i);
            });
            if (idThumb) return path.join(assetPath, idThumb);
        }

        // 3. Check Previews subdirectory
        for (const subDir of ['Previews', 'previews']) {
            const previewsPath = path.join(assetPath, subDir);
            if (await fileExists(previewsPath)) {
                const files = await fs.readdir(previewsPath);
                const thumb = files.find(f => f.toLowerCase().match(/\.(jpg|jpeg|png|webp)$/i));
                if (thumb) return path.join(previewsPath, thumb);
            }
        }
    } catch (e) {
        // Ignore folder read errors
    }
    return undefined;
}

async function walkDir(dir: string, fileList: string[] = [], state = { count: 0 }) {
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
            } else if (file.name.endsWith('.json') && file.name !== 'assetsData.json' && file.name !== 'virtual_folders.json') {
                fileList.push(path.join(dir, file.name));
            } else if (file.name.match(/\.(blend|fbx|obj)$/i) && !file.name.startsWith('.')) {
                // Collect .blend / .fbx / .obj master files as pseudo-assets
                fileList.push(path.join(dir, file.name));
            } else if (file.name.match(/\.(ass|asset)$/i) && !file.name.startsWith('.')) {
                // Collect .ass/.asset encrypted packages as first-class assets
                fileList.push(path.join(dir, file.name));
            }
        }
    } catch (e) { }
    return fileList;
}

export async function generateAssetsData(): Promise<Asset[]> {
    console.log('[generateAssetsData] Initiated.');
    const libraryPath = await getLibraryPath();
    if (!libraryPath) {
        console.log('[generateAssetsData] No library path found.');
        return [];
    }

    const dataPath = path.join(libraryPath, 'Data');
    if (!(await fileExists(dataPath))) {
        try {
            await fs.mkdir(dataPath, { recursive: true });
        } catch (e) {
            console.error('Failed to create Data folder', e);
        }
    }

    console.log(`[generateAssetsData] Walking ${libraryPath}...`);
    const jsonFiles = await walkDir(libraryPath);
    console.log(`[generateAssetsData] Found ${jsonFiles.length} JSON files. Compiling data...`);

    const compiled = [];
    let count = 0;

    // Track IDs we've already seen from JSON to avoid duplicates with master files
    const seenIds = new Set<string>();

    for (const file of jsonFiles) {
        if (++count % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const ext = path.extname(file).toLowerCase();

        // ── Master file (.blend / .fbx / .obj) ──
        if (ext === '.blend' || ext === '.fbx' || ext === '.obj') {
            const basename = path.basename(file, ext);
            const masterId = `master_${basename.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
            if (seenIds.has(masterId)) continue;
            seenIds.add(masterId);

            const assetDir = path.dirname(file);
            const relPath = path.relative(libraryPath, assetDir).replace(/\\/g, '/');

            // Determine type from extension
            let masterType = 'blend';
            if (ext === '.fbx') masterType = 'fbx';
            else if (ext === '.obj') masterType = 'obj_file';

            // File size for tags
            let sizeTag = '';
            try {
                const stat = await fs.stat(file);
                const mb = stat.size / (1024 * 1024);
                sizeTag = mb > 100 ? 'Large File' : mb > 10 ? 'Medium File' : 'Small File';
            } catch (e) { }

            // Try to find a companion thumbnail (same name + .png/.jpg)
            let thumbRel = '';
            for (const thumbExt of ['.png', '.jpg', '.jpeg', '.webp']) {
                const candidate = path.join(assetDir, basename + thumbExt);
                if (await fileExists(candidate)) {
                    const thumbName = `${masterId}${thumbExt}`;
                    const targetThumb = path.join(dataPath, thumbName);
                    try {
                        if (!(await fileExists(targetThumb))) await fs.copyFile(candidate, targetThumb);
                        thumbRel = `Data/${thumbName}`;
                    } catch (e) { }
                    break;
                }
            }

            compiled.push({
                id: masterId,
                name: basename,
                type: masterType,
                path: [relPath],
                thumb: thumbRel,
                tags: [ext.replace('.', '').toUpperCase(), sizeTag, 'Master File', 'Project File'].filter(Boolean),
                categories: [],
                maps: [],
                resolutions: [],
                masterFile: path.basename(file) // store original filename for export
            });
            continue;
        }

        // ── Encrypted .ASS / .ASSET package (v2.0) ──
        if (ext === '.ass' || ext === '.asset') {
            const basename = path.basename(file, ext);
            const assetId = `pkg_${basename.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}`;
            if (seenIds.has(assetId)) continue;
            seenIds.add(assetId);

            const assetDir = path.dirname(file);
            const relPath = path.relative(libraryPath, assetDir).replace(/\\/g, '/');

            // Try reading header to extract thumb for Data/ cache
            let thumbRel = '';
            let thumbContentType = 'image/jpeg';
            try {
                const fd = await fs.open(file, 'r');
                try {
                    const headerBuf = Buffer.alloc(24);
                    await fd.read(headerBuf, 0, 24, 0);
                    const magic = headerBuf.toString('ascii', 0, 4);
                    if (magic === 'ASS!') {
                        const headSize = headerBuf.readUInt32LE(8);
                        const thumbSize = headerBuf.readUInt32LE(12);
                        if (thumbSize > 0) {
                            const thumbBuf = Buffer.alloc(thumbSize);
                            await fd.read(thumbBuf, 0, thumbSize, headSize);

                            // Detect format from magic bytes
                            let thumbExt = '.jpg';
                            if (thumbBuf[0] === 0x89 && thumbBuf[1] === 0x50) thumbExt = '.png';
                            else if (thumbBuf[0] === 0x52 && thumbBuf[1] === 0x49) thumbExt = '.webp';

                            const thumbName = `${assetId}${thumbExt}`;
                            const targetThumb = path.join(dataPath, thumbName);
                            if (!existsSync(targetThumb)) {
                                await fs.writeFile(targetThumb, thumbBuf);
                            }
                            thumbRel = `Data/${thumbName}`;
                        }
                    }
                } finally {
                    await fd.close();
                }
            } catch (e) { /* ignore read errors */ }

            // Determine type from parent folder name heuristics
            let pkgType = '3d';
            const lowerDir = assetDir.toLowerCase();
            if (lowerDir.includes('surface')) pkgType = 'surface';
            else if (lowerDir.includes('decal')) pkgType = 'decal';
            else if (lowerDir.includes('plant')) pkgType = '3dplant';
            else if (lowerDir.includes('atlas')) pkgType = 'atlas';

            // File size for tags
            let sizeTag = '';
            try {
                const stat = await fs.stat(file);
                const mb = stat.size / (1024 * 1024);
                sizeTag = mb > 100 ? 'Large Package' : mb > 10 ? 'Medium Package' : 'Small Package';
            } catch (e) { }

            compiled.push({
                id: assetId,
                name: basename,
                type: pkgType,
                path: [relPath],
                thumb: thumbRel,
                tags: ['Encrypted', 'ASS v2.0', sizeTag, 'Secure Package'].filter(Boolean),
                categories: [],
                maps: [],
                resolutions: [],
                masterFile: path.basename(file)
            });
            continue;
        }

        // ── Standard JSON metadata ──
        try {
            const raw = await fs.readFile(file, 'utf-8');
            const data = JSON.parse(raw);
            if (data && data.id) {
                seenIds.add(data.id);
                let assetPath = path.dirname(file);
                let relPath = path.relative(libraryPath, assetPath).replace(/\\/g, '/');

                // === THUMBNAIL EXTRACTION ===
                let absThumb = '';

                // 1. Try preview/thumb fields (old format)
                let relThumb = Array.isArray(data.preview) ? data.preview.join('/') : data.preview;
                if (!relThumb && Array.isArray(data.thumb)) relThumb = data.thumb.join('/');
                if (relThumb) {
                    absThumb = path.join(libraryPath, relThumb);
                }

                // 2. Try previews.images array (Megascans format)
                if (!absThumb && data.previews?.images && Array.isArray(data.previews.images)) {
                    // Prefer jpeg thumb for performance, fallback to png
                    const jpgThumb = data.previews.images.find((img: any) =>
                        img.tags?.includes('thumb') && img.tags?.includes('jpeg') && img.uri
                    );
                    const pngThumb = data.previews.images.find((img: any) =>
                        img.tags?.includes('thumb') && !img.tags?.includes('tiny') && img.uri
                    );
                    const chosen = jpgThumb || pngThumb;
                    if (chosen?.uri) {
                        absThumb = path.join(assetPath, chosen.uri);
                    }
                }

                // 3. Fallback: search for *_Preview.* or Grid files in asset folder
                if (!absThumb || !(await fileExists(absThumb))) {
                    absThumb = await findThumbnail(assetPath, data.id) || '';
                }

                // Copy thumbnail to Data/ folder for fast serving
                let newRelThumb = '';
                if (absThumb) {
                    const ext = path.extname(absThumb) || '.jpg';
                    const thumbName = `${data.id}${ext}`;
                    const targetThumb = path.join(dataPath, thumbName);
                    try {
                        if (!(await fileExists(targetThumb))) {
                            if (await fileExists(absThumb)) {
                                await fs.copyFile(absThumb, targetThumb);
                            }
                        }

                        // Treat as relative path
                        newRelThumb = `Data/${thumbName}`;
                    } catch (e) { }
                }

                // === TYPE EXTRACTION ===
                let assetType = data.type || '';
                if (!assetType && Array.isArray(data.categories) && data.categories.length > 0) {
                    assetType = data.categories[0];
                }
                if (!assetType && data.semanticTags?.asset_type) {
                    const st = data.semanticTags.asset_type.toLowerCase();
                    if (st.includes('3d') && st.includes('plant')) assetType = '3dplant';
                    else if (st.includes('3d')) assetType = '3d';
                    else assetType = st;
                }
                if (!assetType) assetType = 'unknown';

                // === CATEGORIES EXTRACTION ===
                let cats: string[] = [];
                if (Array.isArray(data.categories)) {
                    cats = data.categories;
                } else if (data.assetCategories && typeof data.assetCategories === 'object') {
                    const flatten = (obj: any): string[] => {
                        const result: string[] = [];
                        for (const key of Object.keys(obj)) {
                            if (typeof obj[key] === 'object' && obj[key] !== null && Object.keys(obj[key]).length > 0) {
                                result.push(...flatten(obj[key]));
                            } else {
                                result.push(key);
                            }
                        }
                        return result;
                    };
                    for (const topKey of Object.keys(data.assetCategories)) {
                        cats.push(...flatten(data.assetCategories[topKey]));
                    }
                }

                // === SMART TAGS, MAPS & RESOLUTIONS INFERENCE ===
                const resSet = new Set<string>();
                let autoMaps: any[] = Array.isArray(data.maps) ? [...data.maps] : [];
                const smartTags = new Set<string>(data.tags || []);

                // Add default map resolutions
                for (const m of autoMaps) {
                    if (m.uri) {
                        const match = m.uri.match(/(\d+K)/i);
                        if (match) resSet.add(match[1].toUpperCase());
                    }
                }

                // Deep analyze actual files in directory
                try {
                    const dirFiles = await fs.readdir(assetPath);
                    for (const f of dirFiles) {
                        // Res extraction
                        const match = f.match(/(\d+K)/i);
                        if (match) resSet.add(match[1].toUpperCase());

                        // Map & Tag extraction via file naming conventions
                        const fl = f.toLowerCase();
                        if (fl.match(/\.(jpg|jpeg|png|exr|tiff|tif|tga)$/i)) {
                            let mapType = '';
                            if (fl.includes('albedo') || fl.includes('basecolor') || fl.includes('diffuse')) mapType = 'albedo';
                            else if (fl.includes('normal')) mapType = 'normal';
                            else if (fl.includes('roughness')) mapType = 'roughness';
                            else if (fl.includes('glossiness') || fl.includes('gloss')) { mapType = 'gloss'; smartTags.add('Glossiness'); }
                            else if (fl.includes('specular') || fl.includes('spec')) { mapType = 'specular'; smartTags.add('Specular'); }
                            else if (fl.includes('displacement') || fl.includes('height') || fl.includes('disp')) mapType = 'displacement';
                            else if (fl.includes('cavity')) mapType = 'cavity';
                            else if (fl.includes('ao') || fl.includes('ambientocclusion')) mapType = 'ao';
                            else if (fl.includes('opacity')) mapType = 'opacity';
                            else if (fl.includes('translucency') || fl.includes('transmission')) mapType = 'translucency';
                            else if (fl.includes('ord')) mapType = 'ord';

                            // Inject map if not exist in original metadata
                            if (mapType && !autoMaps.find(m => m.type?.toLowerCase() === mapType && m.uri === f)) {
                                autoMaps.push({ type: mapType, uri: f, mimeType: `image/${path.extname(f).replace('.', '')}` });
                            }
                        }
                    }

                    // Folder structure heuristics fallback
                    const lowerAssetPath = assetPath.toLowerCase();
                    if (lowerAssetPath.includes('3d_plant')) { assetType = '3dplant'; smartTags.add('Plant'); }
                    else if (lowerAssetPath.includes('3d_') && assetType === 'unknown') { assetType = '3d'; smartTags.add('3D Model'); }
                    else if (lowerAssetPath.includes('surface') && assetType === 'unknown') { assetType = 'surface'; smartTags.add('Surface'); }
                    else if (lowerAssetPath.includes('decal') && assetType === 'unknown') { assetType = 'decal'; smartTags.add('Decal'); }
                    else if (lowerAssetPath.includes('atlas') && assetType === 'unknown') { assetType = 'atlas'; smartTags.add('Atlas'); }

                } catch (e) { }

                const resolutions = [...resSet].sort((a, b) => {
                    const numA = parseInt(a); const numB = parseInt(b);
                    return numA - numB;
                });

                compiled.push({
                    id: data.id,
                    name: data.name || data.id,
                    type: assetType,
                    path: [relPath],
                    thumb: newRelThumb,
                    tags: Array.from(smartTags),
                    categories: cats,
                    maps: autoMaps,
                    resolutions
                });
            }
        } catch (e) { }
    }

    try {
        console.log(`[generateAssetsData] Compiled ${compiled.length} assets. Writing to JSON...`);
        const assetsDataPath = path.join(dataPath, 'assetsData.json');
        await fs.writeFile(assetsDataPath, JSON.stringify(compiled, null, 2));
        console.log('[generateAssetsData] Write successful.');
    } catch (e) {
        console.error('Failed to write assetsData.json:', e);
    }

    // Now re-fetch using standard pipeline 
    console.log('[generateAssetsData] Re-fetching using standard pipeline...');
    return await getAssets();
}
