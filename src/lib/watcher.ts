import chokidar from 'chokidar';
import { getLibraryPath, generateAssetsData } from './assets';

let watcher: any = null;
let lastUpdate = Date.now();
let isGenerating = false;

// We use global to persist watcher across Next.js HMR reloads
const globalAny: any = global;

export async function initWatcher() {
    if (globalAny.__watcherActive) return;

    const libPath = await getLibraryPath();
    if (!libPath) return;

    // Ignore Data folder to prevent infinite loops (since generateAssetsData writes there)
    const watcherInstance = chokidar.watch(libPath, {
        ignored: /(^|[\/\\])\..|Data/, // ignore dotfiles and Data folder
        persistent: true,
        ignoreInitial: true,
        depth: 4 // Usually megascans don't go deeper than 4 levels
    });

    const triggerUpdate = async (event: string, filePath: string) => {
        if (isGenerating) return;
        isGenerating = true;
        console.log(`[WATCHDOG] ${event} detected at ${filePath}`);
        console.log('[WATCHDOG] Library change detected. Regenerating assets array in background...');
        try {
            await generateAssetsData();
            lastUpdate = Date.now();
            globalAny.__lastLibraryUpdate = lastUpdate;
            console.log('[WATCHDOG] Asset library regenerated successfully.');

            // Broadcast version change event via Socket.IO for Asset Git
            try {
                const io = globalAny.io;
                if (io) {
                    // Extract asset folder from changed file path
                    const relative = filePath.replace(libPath + '\\', '').replace(libPath + '/', '');
                    const parts = relative.split(/[\\/]/);
                    const assetFolder = parts.length >= 2 ? parts.slice(0, 2).join('/') : parts[0];
                    io.emit('asset_changed', {
                        path: filePath,
                        event,
                        assetFolder,
                        timestamp: new Date().toISOString()
                    });
                    console.log('[WATCHDOG] 📢 Broadcasted asset_changed event for', assetFolder);
                }
            } catch (socketErr) { /* socket not available */ }
        } catch (e) {
            console.error('[WATCHDOG] Error regenerating assets', e);
        }
        isGenerating = false;
    };

    let debounceTimer: NodeJS.Timeout | null = null;
    const onChange = (event: string, path: string) => {
        if (debounceTimer) clearTimeout(debounceTimer);
        // Wait 5 seconds after a file event to let all copying/extracted finish
        debounceTimer = setTimeout(() => triggerUpdate(event, path), 5000);
    };

    watcherInstance.on('all', onChange);

    globalAny.__watcherActive = true;
    watcher = watcherInstance;
    console.log('[WATCHDOG] 📡 Live folder sync started! Listening to changes in:', libPath);
}

export function getLastLibraryUpdate() {
    return globalAny.__lastLibraryUpdate || lastUpdate;
}
