import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export async function GET() {
    try {
        const script = `Add-Type -AssemblyName System.windows.forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = 'Select Library Folder'; $f.ShowNewFolderButton = $true; if($f.ShowDialog() -eq 'OK'){ Write-Output $f.SelectedPath }`;
        const { stdout } = await execPromise(`powershell -NoProfile -Command "${script}"`);
        const path = stdout.trim();

        if (path) {
            return NextResponse.json({ path });
        } else {
            return NextResponse.json({ error: 'No folder selected' }, { status: 400 });
        }
    } catch (err) {
        console.error('Failed to open folder picker:', err);
        return NextResponse.json({ error: 'Failed to open folder picker' }, { status: 500 });
    }
}
