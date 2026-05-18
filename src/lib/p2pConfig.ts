// P2P Configuration — Central ICE/TURN servers

/**
 * P2P Configuration — Central ICE/TURN servers
 *
 * Hierarchia:
 *   1. Custom TURN z env vars (NEXT_PUBLIC_TURN_*)
 *   2. PeerJS cloud default TURN
 *   3. Metered.ca free TURN
 *   4. Google STUN (zawsze includowany)
 *
 * Override: ustaw w .env.local:
 *   NEXT_PUBLIC_TURN_URL=turn:your-server.com:3478
 *   NEXT_PUBLIC_TURN_USER=username
 *   NEXT_PUBLIC_TURN_PASS=password
 */

export interface IceConfig {
    iceServers: RTCIceServer[];
    sdpSemantics?: string;
    iceCandidatePoolSize?: number;
}

export function getIceConfig(appConfig?: any): IceConfig {
    const servers: RTCIceServer[] = [
        // 1. Google STUN (zawsze dostępny, zero kosztów)
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },

        // 2. PeerJS cloud TURN (default w peerjs, darmowy, best-effort)
        {
            urls: [
                'turn:eu-0.turn.peerjs.com:3478',
                'turn:us-0.turn.peerjs.com:3478'
            ],
            username: 'peerjs',
            credential: 'peerjsp'
        },

        // 3. OpenRelay free TURN (metered.ca community)
        {
            urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turns:openrelay.metered.ca:443'
            ],
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ];

    // 4. Custom TURN from env vars or appConfig (highest priority)
    const customUrl = appConfig?.turnUrl || process.env.NEXT_PUBLIC_TURN_URL;
    const customUser = appConfig?.turnUser || process.env.NEXT_PUBLIC_TURN_USER;
    const customPass = appConfig?.turnPass || process.env.NEXT_PUBLIC_TURN_PASS;

    if (customUrl && customUser && customPass) {
        servers.unshift({
            urls: customUrl,
            username: customUser,
            credential: customPass
        });
        if (typeof window !== 'undefined') {
            console.log('[P2P] Custom TURN server added to configuration');
        }
    } else if (typeof window !== 'undefined') {
        console.log('[P2P] Using default public TURN infrastructure');
    }

    return {
        iceServers: servers
    };
}

/**
 * Returns a summary string for debugging/UI display
 */
export function getIceConfigSummary(appConfig?: any): { turnCount: number; stunCount: number; hasCustom: boolean } {
    const config = getIceConfig(appConfig);
    let turnCount = 0;
    let stunCount = 0;

    for (const server of config.iceServers) {
        const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
        for (const url of urls) {
            if (url.startsWith('turn') || url.startsWith('turns')) turnCount++;
            else if (url.startsWith('stun')) stunCount++;
        }
    }

    return {
        turnCount,
        stunCount,
        hasCustom: Boolean(appConfig?.turnUrl || process.env.NEXT_PUBLIC_TURN_URL)
    };
}
