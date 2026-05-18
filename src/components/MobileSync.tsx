import React, { useState, useEffect, useRef } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getIceConfig } from '@/lib/p2pConfig';

export default function MobileSync() {
    const [peerId, setPeerId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [showPopover, setShowPopover] = useState(false);
    const peerRef = useRef<any>(null);

    useEffect(() => {
        // dynamic import of peerjs to avoid SSR issues
        import('peerjs').then(({ default: Peer }) => {
            const shortId = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit code
            const iceConfig = getIceConfig();
            const peer = new Peer(`bridge-pc-${shortId}`, {
                debug: 3,
                pingInterval: 5000,
                config: iceConfig
            });

            peer.on('open', (id) => {
                setPeerId(shortId);
                localStorage.setItem('last_mobile_pin', shortId);
            });

            peer.on('connection', (conn) => {
                setIsConnected(true);
                setShowPopover(false);
                toast.success('Mobile Device Connected!');

                conn.on('data', (data: any) => {
                    console.log('Mobile command received:', data);
                    // Handle scrolling, clicking, syncing directly
                    if (data.type === 'PING') conn.send({ type: 'PONG', msg: 'Hello from PC' });
                    window.dispatchEvent(new CustomEvent('mobile_command', {
                        detail: {
                            ...data,
                            sendBack: (res: any) => conn.send(res)
                        }
                    }));
                });

                conn.on('close', () => {
                    setIsConnected(false);
                    toast.error('Mobile Device Disconnected');
                });
            });

            peerRef.current = peer;
        });

        return () => {
            if (peerRef.current) peerRef.current.destroy();
        };
    }, []);

    return (
        <div className="relative">
            <button
                onClick={() => setShowPopover(!showPopover)}
                className={`
                    w-[120px] h-[80px] rounded-2xl text-[13px] font-black uppercase tracking-widest transition-all duration-300 border flex flex-col justify-center items-center gap-2
                    ${isConnected
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] hover:shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:border-emerald-400 cursor-pointer'
                        : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10 hover:text-white hover:border-accent/40 cursor-pointer'
                    }
                `}
                title="Mobile Remote Control"
            >
                <img
                    src={isConnected ? "/lights/phonesynch_green.png" : "/lights/phonesynch_red.png"}
                    alt="Status"
                    className="w-14 h-14 object-contain mb-[-4px]"
                />
                <span className="text-[10px] leading-tight text-center">Mobile<br />Sync</span>
            </button>

            {showPopover && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 p-5 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl z-50 w-[280px] flex flex-col items-center gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button onClick={() => setShowPopover(false)} className="absolute top-3 right-3 p-1 text-slate-500 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                    </button>

                    <div className={`p-4 rounded-full ${isConnected ? 'bg-emerald-500/10' : 'bg-red-500/10 border border-red-500/20'}`}>
                        <img
                            src={isConnected ? "/phone_connected.png" : "/phone_disconnected.png"}
                            alt="Mobile Status"
                            className="w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                        />
                    </div>

                    <div className="text-center space-y-1">
                        <h3 className="font-bold text-white text-sm tracking-wide">Mobile Remote</h3>
                        <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                            Control your library directly via internet bypassing your local Firewall.
                        </p>
                    </div>

                    {isConnected ? (
                        <div className="flex flex-col items-center gap-2 w-full mt-2">
                            <div className="px-4 py-2 w-full bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center gap-2">
                                <Check className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs text-emerald-400 font-bold tracking-widest uppercase">Connected</span>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-2 px-6 py-4 bg-black/40 rounded-xl border border-white/5 w-full mt-2">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Pairing Pin Code</span>
                            {peerId ? (
                                <span className="text-4xl font-mono font-black text-white tracking-[0.2em]">{peerId}</span>
                            ) : (
                                <Loader2 className="w-6 h-6 animate-spin text-accent my-2" />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
