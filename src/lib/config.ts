import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

export async function getConfig() {
    try {
        if (existsSync(CONFIG_PATH)) {
            const content = await fs.readFile(CONFIG_PATH, 'utf-8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error('Failed to read config file:', e);
    }
    return {};
}

export async function getLibraryPath() {
    const config = await getConfig();
    return config.libraryPath || process.env.LIBRARY_PATH || '';
}

export async function getUnrealPath() {
    const config = await getConfig();
    return config.unrealPath || '';
}

export async function saveConfig(updates: any) {
    const current = await getConfig();
    const merged = { ...current, ...updates };
    await fs.writeFile(CONFIG_PATH, JSON.stringify(merged, null, 2));
    return merged;
}
