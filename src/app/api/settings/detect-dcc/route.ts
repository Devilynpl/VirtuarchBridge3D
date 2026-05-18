import { NextRequest, NextResponse } from 'next/server';
import { existsSync } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * 🔍 DCC Software Auto-Scanner API
 * 
 * Scans typical installation locations for DCC software
 * (Blender, Maya, 3ds Max, Houdini, ZBrush, Unreal Engine).
 * 
 * Returns which programs were found and their install paths.
 * If not found via scanning, the client prompts user to browse for it.
 */

interface DccSoftware {
    id: string;
    name: string;
    found: boolean;
    path: string | null;
    version?: string;
}

// ═══════════════════════════════════════
//  Typical install paths per software
// ═══════════════════════════════════════
const DCC_SEARCH_PATHS: Record<string, string[]> = {
    blender: [
        'C:/Program Files/Blender Foundation/Blender',
        'C:/Program Files/Blender Foundation/Blender 4.3',
        'C:/Program Files/Blender Foundation/Blender 4.2',
        'C:/Program Files/Blender Foundation/Blender 4.1',
        'C:/Program Files/Blender Foundation/Blender 4.0',
        'C:/Program Files/Blender Foundation/Blender 3.6',
        'C:/Program Files/Blender Foundation/Blender 3.5',
        'C:/Program Files (x86)/Steam/steamapps/common/Blender',
        `${process.env.USERPROFILE}/AppData/Roaming/Blender Foundation`,
        `${process.env.LOCALAPPDATA}/Programs/Blender Foundation/Blender`,
    ],
    maya: [
        'C:/Program Files/Autodesk/Maya2025',
        'C:/Program Files/Autodesk/Maya2024',
        'C:/Program Files/Autodesk/Maya2023',
        'C:/Program Files/Autodesk/Maya2022',
        'C:/Program Files/Autodesk/Maya2021',
        'C:/Program Files/Autodesk/Maya2020',
    ],
    '3ds': [
        'C:/Program Files/Autodesk/3ds Max 2025',
        'C:/Program Files/Autodesk/3ds Max 2024',
        'C:/Program Files/Autodesk/3ds Max 2023',
        'C:/Program Files/Autodesk/3ds Max 2022',
        'C:/Program Files/Autodesk/3ds Max 2021',
    ],
    houdini: [
        'C:/Program Files/Side Effects Software/Houdini 20.5',
        'C:/Program Files/Side Effects Software/Houdini 20.0',
        'C:/Program Files/Side Effects Software/Houdini 19.5',
        'C:/Program Files/Side Effects Software/Houdini 19.0',
        'C:/Program Files/Side Effects Software',
    ],
    zbrush: [
        'C:/Program Files/Maxon ZBrush 2025',
        'C:/Program Files/Maxon ZBrush 2024',
        'C:/Program Files/Maxon ZBrush 2023',
        'C:/Program Files/Pixologic/ZBrush 2022',
        'C:/Program Files/Pixologic/ZBrush 2021',
        'C:/Program Files/Maxon/ZBrush',
        'C:/Program Files/Maxon ZBrush',
    ],
    ue: [
        'C:/Program Files/Epic Games/UE_5.5',
        'C:/Program Files/Epic Games/UE_5.4',
        'C:/Program Files/Epic Games/UE_5.3',
        'C:/Program Files/Epic Games/UE_5.2',
        'C:/Program Files/Epic Games/UE_5.1',
        'C:/Program Files/Epic Games/UE_5.0',
        'C:/Program Files (x86)/Epic Games/Launcher',
    ],
};

// Known executable names to check for existence
const DCC_EXECUTABLES: Record<string, string[]> = {
    blender: ['blender.exe', 'blender-launcher.exe'],
    maya: ['bin/maya.exe'],
    '3ds': ['3dsmax.exe'],
    houdini: ['bin/houdini.exe', 'bin/houdinifx.exe'],
    zbrush: ['ZBrush.exe'],
    ue: ['Engine/Binaries/Win64/UnrealEditor.exe'],
};

function findDcc(softwareId: string): { found: boolean; path: string | null; version?: string } {
    const searchPaths = DCC_SEARCH_PATHS[softwareId] || [];
    const executables = DCC_EXECUTABLES[softwareId] || [];

    for (const searchPath of searchPaths) {
        const normalizedPath = path.normalize(searchPath);

        // Check if the base directory exists
        if (!existsSync(normalizedPath)) continue;

        // If there are specific executables to check for, verify one exists
        if (executables.length > 0) {
            for (const exe of executables) {
                const fullExePath = path.join(normalizedPath, exe);
                if (existsSync(fullExePath)) {
                    // Try to extract version from path name
                    const versionMatch = normalizedPath.match(/(\d+\.?\d*)/);
                    return {
                        found: true,
                        path: normalizedPath,
                        version: versionMatch ? versionMatch[1] : undefined
                    };
                }
            }
        } else {
            // Just check if the directory exists (fallback)
            return {
                found: true,
                path: normalizedPath,
                version: undefined
            };
        }
    }

    // Windows registry fallback for certain apps
    if (process.platform === 'win32') {
        try {
            const regPaths: Record<string, string> = {
                blender: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\BlenderFoundation',
                maya: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\Maya',
                '3ds': 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Autodesk\\3dsMax',
                houdini: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Side Effects Software',
                zbrush: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Pixologic',
            };

            const regKey = regPaths[softwareId];
            if (regKey) {
                const result = execSync(`reg query "${regKey}" /s`, {
                    encoding: 'utf-8',
                    timeout: 3000,
                    windowsHide: true,
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                if (result && result.length > 0) {
                    // Try to extract install path from registry output
                    const pathMatch = result.match(/InstallPath\s+REG_SZ\s+(.+)/i) ||
                        result.match(/InstallLocation\s+REG_SZ\s+(.+)/i) ||
                        result.match(/Path\s+REG_SZ\s+(.+)/i);
                    if (pathMatch) {
                        const regPath = pathMatch[1].trim();
                        if (existsSync(regPath)) {
                            return { found: true, path: regPath };
                        }
                    }
                    // Registry key exists even without extractable path
                    return { found: true, path: null };
                }
            }
        } catch (e) {
            // Registry query failed — software not in registry
        }
    }

    return { found: false, path: null };
}

export async function GET(req: NextRequest) {
    const results: DccSoftware[] = [];

    for (const softwareId of Object.keys(DCC_SEARCH_PATHS)) {
        const name = {
            blender: 'Blender',
            maya: 'Maya',
            '3ds': '3ds Max',
            houdini: 'Houdini',
            zbrush: 'ZBrush',
            ue: 'Unreal Engine'
        }[softwareId] || softwareId;

        const scanResult = findDcc(softwareId);

        results.push({
            id: softwareId,
            name,
            found: scanResult.found,
            path: scanResult.path,
            version: scanResult.version
        });
    }

    const foundCount = results.filter(r => r.found).length;
    console.log(`[DCC Scanner] Found ${foundCount}/${results.length} installed: ${results.filter(r => r.found).map(r => r.name).join(', ') || 'none'}`);

    return NextResponse.json({
        software: results,
        foundCount,
        totalScanned: results.length,
        platform: process.platform
    });
}
