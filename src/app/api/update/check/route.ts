import { NextResponse } from 'next/server';

// GitHub Releases API check
// Repository: https://github.com/YOUR_USERNAME/3d-bridge-releases
// Create a public GitHub repo, push a release with tag v1.0.0 and attach .exe/.zip installer
// The API returns latest release info including tag_name and assets download URLs.

const GITHUB_REPO = process.env.UPDATE_GITHUB_REPO || 'VirtuArch-Software/3d-bridge-releases';
const CURRENT_VERSION = process.env.npm_package_version || '0.1.0';

function parseVersion(v: string) {
    // Strips leading 'v' e.g. "v1.2.3" -> [1, 2, 3]
    return v.replace(/^v/, '').split('.').map(Number);
}

function isNewerVersion(latest: string, current: string): boolean {
    const l = parseVersion(latest);
    const c = parseVersion(current);
    for (let i = 0; i < Math.max(l.length, c.length); i++) {
        const lv = l[i] ?? 0;
        const cv = c[i] ?? 0;
        if (lv > cv) return true;
        if (lv < cv) return false;
    }
    return false;
}

export async function GET() {
    try {
        const apiUrl = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
        const res = await fetch(apiUrl, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': '3D-Bridge-App'
            },
            next: { revalidate: 300 } // cache 5 min
        });

        if (!res.ok) {
            if (res.status === 404) {
                // Repo or release not found — treat as up to date
                return NextResponse.json({
                    upToDate: true,
                    currentVersion: CURRENT_VERSION,
                    latestVersion: CURRENT_VERSION,
                    message: 'No release channel configured yet.'
                });
            }
            return NextResponse.json({ error: 'Failed to reach update server' }, { status: 502 });
        }

        const release = await res.json();
        const latestVersion = release.tag_name as string; // e.g. "v1.2.0"
        const upToDate = !isNewerVersion(latestVersion, CURRENT_VERSION);

        // Find Windows installer asset
        const installerAsset = (release.assets as any[])?.find((a: any) =>
            /\.(exe|msi|zip|nsis)$/i.test(a.name)
        );

        return NextResponse.json({
            upToDate,
            currentVersion: CURRENT_VERSION,
            latestVersion: latestVersion.replace(/^v/, ''),
            releaseDate: release.published_at,
            releaseNotes: release.body || '',
            downloadUrl: installerAsset?.browser_download_url || release.html_url,
            releasePage: release.html_url,
        });
    } catch (err) {
        console.error('Update check error:', err);
        return NextResponse.json({ error: 'Network error during update check' }, { status: 503 });
    }
}
