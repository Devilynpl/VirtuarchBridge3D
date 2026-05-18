const electronPath = require('electron');
const { spawn } = require('child_process');

console.log('Spawning electron from:', electronPath);

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env });

child.on('close', (code) => {
    console.log('Electron exited with code:', code);
    process.exit(code);
});

child.on('error', (err) => {
    console.error('Failed to start electron:', err);
});
