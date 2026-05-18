const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { setupMenu } = require('./menu');
const { spawn } = require('child_process');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
let nextProcess = null;
let splash = null;

// ==========================================
// LOGGING SYSTEM (Production Debugging)
// ==========================================
const logPath = path.join(app.getPath('userData'), 'bridge_debug.log');
function log(msg) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync(logPath, formatted);
}

log('--- APPLICATION START ---');
log(`App Version: ${app.getVersion()}`);
log(`Platform: ${process.platform}`);
log(`Resources Path: ${process.resourcesPath}`);

// ==========================================
// PATH RESOLUTION
// ==========================================
const ROOT_DIR = path.join(__dirname, '..');
const UNPACKED_PATH = path.join(process.resourcesPath, 'app.asar.unpacked');
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');

function sendStatusToSplash(status, progress) {
    if (process.env.ELECTRON_RUN_AS_NODE) return;
    if (splash && !splash.isDestroyed()) {
        const text = (status || '').replace(/["']/g, '');
        splash.webContents.executeJavaScript(`if(window.updateStatus) window.updateStatus("${text}", ${progress});`).catch(() => { });
    }
}

// ==========================================
// SINGLE INSTANCE LOCK & FILE ASSOCIATION
// ==========================================
if (!process.env.ELECTRON_RUN_AS_NODE) {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        log('Duplicate instance detected. Exiting.');
        app.quit();
    } else {
        app.on('second-instance', (event, commandLine) => {
            log('Second instance triggered with args: ' + JSON.stringify(commandLine));

            // Handle file association from secondary instance
            const filePath = findFilePathInArgs(commandLine);
            if (filePath) {
                openViewer(filePath);
            } else {
                const windows = BrowserWindow.getAllWindows();
                if (windows.length > 0) {
                    if (windows[0].isMinimized()) windows[0].restore();
                    windows[0].focus();
                }
            }
        });

        // Finalize association link (macOS)
        app.on('open-file', (event, path) => {
            event.preventDefault();
            log('macOS Open file triggered: ' + path);
            openViewer(path);
        });

        app.whenReady().then(bootApp);
    }
}

function findFilePathInArgs(argv) {
    // Basic heuristics: find strings with .asset, .obj, .fbx, .glb, .gltf extensions
    const supported = ['.asset', '.obj', '.fbx', '.glb', '.gltf'];
    for (const arg of argv) {
        if (supported.some(ext => arg.toLowerCase().endsWith(ext)) && fs.existsSync(arg)) {
            return arg;
        }
    }
    return null;
}

// Global reference for ports
let currentUiPort = 3010;

function openViewer(filePath) {
    const filePathEncoded = encodeURIComponent(filePath);
    const url = isDev ? `http://127.0.0.1:3010/view?file=${filePathEncoded}` : `http://127.0.0.1:${currentUiPort}/view?file=${filePathEncoded}`;

    log(`Opening Viewer for: ${filePath}`);

    const viewWin = new BrowserWindow({
        width: 1200, height: 800,
        backgroundColor: '#020617',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    viewWin.loadURL(url);
}

async function findFreePorts(startPort, secondStartPort) {
    const net = require('net');
    const check = (p) => new Promise(res => {
        const s = net.createServer();
        s.once('error', () => res(false));
        s.once('listening', () => { s.close(); res(true); });
        s.listen(p, '127.0.0.1');
    });
    const getNext = async (s) => {
        let p = s;
        while (!(await check(p))) { p++; if (p > s + 1000) throw new Error('No ports'); }
        return p;
    };
    return Promise.all([getNext(startPort), getNext(secondStartPort)]);
}

async function bootApp() {
    try {
        const [uiPort, p2pPort] = await findFreePorts(3015, 9010);
        log(`Ports Allocated - UI: ${uiPort}, P2P: ${p2pPort}`);

        createSplashScreen();
        sendStatusToSplash('Initializing Bridge v0.1.0...', 10);

        // ==========================================
        // FIRST RUN TRACKING (Licznik instalacji)
        // ==========================================
        try {
            const firstRunFilePath = path.join(app.getPath('userData'), '.bridge_first_run');
            if (!fs.existsSync(firstRunFilePath)) {
                log('First run detected! Sending installation ping...');
                
                // PODMIEŃ TEN ADRES URL NA ADRES SWOJEGO SERWERA ZLICZAJĄCEGO
                // Może to być np. prosty endpoint na Vercel lub inny serwer:
                const trackingUrl = 'https://twoja-domena.pl/api/track-install?app=bridge';
                
                const https = require('https');
                https.get(trackingUrl, (res) => {
                    log(`Install ping sent. Server responded with: ${res.statusCode}`);
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        // Zapisz flagę, że ping został wysłany z sukcesem
                        fs.writeFileSync(firstRunFilePath, new Date().toISOString());
                        log('First run flag saved.');
                    }
                }).on('error', (e) => {
                    log(`Install ping failed (no internet or server down): ${e.message}`);
                    // Flaga nie jest zapisywana, więc przy kolejnym uruchomieniu aplikacja spróbuje ponownie
                });
            } else {
                log('Not a first run, skipping installation ping.');
            }
        } catch (error) {
            log(`Error in first run tracking: ${error.message}`);
        }

        // 1. P2P Server
        const p2pApp = express();
        p2pApp.use(cors());
        const p2pServer = p2pApp.listen(p2pPort, '127.0.0.1', () => {
            log(`P2P signaling active on ${p2pPort}`);
        });

        const { PeerServer } = require('peer');
        PeerServer({ port: p2pPort, path: '/peerjs/bridge', server: p2pServer, allow_discovery: true });
        ipcMain.handle('get-p2p-port', () => p2pPort);

        // 2. Render Engine
        if (!isDev) {
            // Priority 1: Check for Unpacked ASAR (Production)
            let enginePath = path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone', 'server.js');
            let cwd = path.join(process.resourcesPath, 'app.asar.unpacked', '.next', 'standalone');

            // Priority 2: Check for local standalone (Dev/Manual test)
            if (!fs.existsSync(enginePath)) {
                enginePath = path.join(ROOT_DIR, '.next', 'standalone', 'server.js');
                cwd = path.join(ROOT_DIR, '.next', 'standalone');
            }

            // Priority 3: Fallback / Debug
            if (!fs.existsSync(enginePath)) {
                log('Engine not found at primary paths. Trying relative to __dirname...');
                enginePath = path.join(__dirname, '..', '.next', 'standalone', 'server.js');
                cwd = path.join(__dirname, '..', '.next', 'standalone');
            }

            // CRITICAL: If the resolved path is inside an ASAR, we MUST redirect it to unpacked
            if (enginePath.includes('.asar') && !enginePath.includes('.asar.unpacked')) {
                log('REDIRECTION: Detected path inside ASAR. Redirecting to unpacked...');
                enginePath = enginePath.replace('.asar', '.asar.unpacked');
                cwd = cwd.replace('.asar', '.asar.unpacked');
            }

            log(`Final Engine Path: ${enginePath}`);
            log(`Final CWD: ${cwd}`);

            if (!fs.existsSync(enginePath)) {
                log('❌ FATAL: Next.js Server not found on disk.');
                sendStatusToSplash('❌ FATAL: Server engine missing.', 0);
                return;
            }

            // We use the direct executable path. On Windows, we don't need shell:true 
            // if we provide the absolute path to the executable and avoid complex quoting issues.
            nextProcess = spawn(process.execPath, [enginePath], {
                cwd: cwd,
                env: {
                    ...process.env,
                    NODE_ENV: 'production',
                    NEXT_PUBLIC_P2P_PORT: p2pPort.toString(),
                    HOSTNAME: '127.0.0.1',
                    PORT: uiPort.toString(),
                    ELECTRON_RUN_AS_NODE: '1'
                },
                shell: false, // Shell:true was causing cmd.exe ENOENT
                windowsHide: true
            });

            nextProcess.on('error', (err) => {
                log(`SPAWN_ERROR: ${err.message}`);
            });

            nextProcess.stdout.on('data', (data) => {
                const msg = data.toString().trim();
                log(`[Server] ${msg}`);
                if (msg.includes('ready') || msg.includes('listening')) sendStatusToSplash('Dashboard: READY.', 60);
            });

            nextProcess.stderr.on('data', (d) => {
                const msg = d.toString().trim();
                if (!msg.includes('experimental')) {
                    log(`[Server Error] ${msg}`);
                }
            });

            nextProcess.on('exit', (code) => {
                log(`Server process exited with code ${code}`);
                if (code !== 0 && code !== null) sendStatusToSplash(`❌ ENGINE_CRASHED (${code})`, 0);
            });
        }

        // 3. Main Window or Initial Viewer
        const initialFile = findFilePathInArgs(process.argv);
        currentUiPort = uiPort;

        if (initialFile) {
            log('Initial file detected. Launching viewer.');
            openViewer(initialFile);
        } else {
            createMainWindow(uiPort);
        }

    } catch (err) {
        log(`BOOT_FATAL: ${err.stack}`);
        sendStatusToSplash(`❌ BOOT_FAILURE: ${err.message}`, 0);
    }
}

function createMainWindow(uiPort) {
    const win = new BrowserWindow({
        width: 1400, height: 900,
        title: '3D Bridge Share',
        backgroundColor: '#0a0a0b',
        show: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    setupMenu(win);

    const url = isDev ? `http://127.0.0.1:3010` : `http://127.0.0.1:${uiPort}`;
    let retry = 0;
    const load = () => {
        log(`Loading URL: ${url} (Attempt ${retry + 1})`);
        win.loadURL(url).catch((err) => {
            log(`Load failure: ${err.message}`);
            retry++;
            if (retry < 120) setTimeout(load, 1000);
            else {
                log('TIMEOUT: Could not connect to internal server.');
                win.webContents.openDevTools();
                sendStatusToSplash('❌ TIMEOUT: Internal port blocked.', 0);
            }
        });
    };

    win.once('ready-to-show', () => {
        log('Main Window ready to show.');
        // Increase delay to 5 seconds so user can actually read the console on splash
        setTimeout(() => {
            if (splash && !splash.isDestroyed()) splash.close();
            win.show();
            win.maximize();
        }, 5000);
    });

    load();

    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) { shell.openExternal(url); return { action: 'deny' }; }
        return { action: 'allow' };
    });
}

function createSplashScreen() {
    splash = new BrowserWindow({
        width: 600, height: 500, // Increased height for console visibility
        transparent: true, frame: false, alwaysOnTop: true,
        webPreferences: { nodeIntegration: true, contextIsolation: false }
    });
    splash.loadFile(path.join(__dirname, '..', 'Loader', 'splash.html'));
}

app.on('window-all-closed', () => {
    log('Application closing.');
    if (nextProcess) nextProcess.kill();
    if (process.platform !== 'darwin') app.quit();
});
