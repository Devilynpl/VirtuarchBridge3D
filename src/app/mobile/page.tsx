'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone, MonitorPlay, Box, RefreshCw, Send, CheckCircle2, ChevronRight, Share2, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { getIceConfig } from '@/lib/p2pConfig';

export default function MobileAppPage() {
    const [pinCode, setPinCode] = useState('');
    const [isConnected, setIsConnected] = useState(false);
    const [assets, setAssets] = useState<any[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isConnecting, setIsConnecting] = useState(false);
    // Use a record to store decimation ratios per asset ID on mobile
    const [decimations, setDecimations] = useState<Record<string, number>>({});

    const peerRef = useRef<any>(null);
    const connRef = useRef<any>(null);

    useEffect(() => {
        // Fix for standard screen size on mobile
        document.body.style.overscrollBehavior = 'none';
        return () => { document.body.style.overscrollBehavior = 'auto'; };
    }, []);

    const connectToPC = () => {
        if (pinCode.length !== 6) {
            toast.error('PIN code must be 6 digits');
            return;
        }

        setIsConnecting(true);

        import('peerjs').then(({ default: Peer }) => {
            const iceConfig = getIceConfig();
            const peer = new Peer({
                debug: 3,
                pingInterval: 5000,
                config: iceConfig
            });

            peer.on('open', (id) => {
                const conn = peer.connect(`bridge-pc-${pinCode}`);
                connRef.current = conn;

                conn.on('open', () => {
                    setIsConnected(true);
                    setIsConnecting(false);
                    toast.success('Connected to PC!');

                    // Request library data
                    conn.send({ type: 'COMMAND', command: 'GET_LIBRARY' });
                });

                conn.on('data', (data: any) => {
                    if (data.type === 'LIBRARY_DATA') {
                        setAssets(data.assets || []);

                        // Extract unique types/categories
                        const cats = new Set<string>();
                        data.assets.forEach((a: any) => cats.add(a.type));
                        setCategories(['all', ...Array.from(cats)]);
                    } else if (data.type === 'PONG') {
                        toast.success('PC is responsive');
                    }
                });

                conn.on('close', () => {
                    setIsConnected(false);
                    setAssets([]);
                    toast.error('Connection to PC lost');
                });
            });

            peer.on('error', (err) => {
                setIsConnecting(false);
                toast.error('Connection failed. Check PIN.');
                console.error('Peer error:', err);
            });

            peerRef.current = peer;
        });
    };

    const triggerExport = (assetInfo: any) => {
        if (!connRef.current) return;
        const assetDecimation = decimations[assetInfo.id] ?? 100;
        connRef.current.send({
            type: 'COMMAND',
            command: 'EXPORT_ASSET',
            asset: { ...assetInfo, decimation: assetDecimation / 100.0 }
        });
        toast.success(`Exporting ${assetInfo.name} to software...`);
    };

    const disconnect = () => {
        if (connRef.current) connRef.current.close();
        if (peerRef.current) peerRef.current.destroy();
        setIsConnected(false);
        setAssets([]);
        setPinCode('');
    };

    // Filter assets
    const filteredAssets = assets.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCat = selectedCategory === 'all' || a.type === selectedCategory;
        return matchesSearch && matchesCat;
    });

    if (!isConnected) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 flex-col font-sans selection:bg-accent/30 fixed inset-0">
                {/* Background effects */}
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.15),transparent_50%)]" />

                <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col items-center mb-10">
                        <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center border border-accent/20 mb-6 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
                            <Smartphone className="w-10 h-10 text-accent" />
                        </div>
                        <h1 className="text-3xl font-black text-white tracking-tighter mb-2">3DBRIDGE</h1>
                        <div className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest rounded-full border border-accent/20">
                            Remote Control
                        </div>
                    </div>

                    <div className="glass p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Pairing PIN</label>
                            <input
                                type="text"
                                value={pinCode}
                                onChange={(e) => setPinCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                placeholder="123456"
                                className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl py-4 px-6 text-center text-3xl font-mono text-white tracking-[0.25em] focus:border-accent focus:outline-none transition-all placeholder:text-slate-700"
                            />
                            <p className="text-xs text-slate-500 text-center mt-3">
                                Get this PIN from the PC app header (Mobile Sync).
                            </p>
                        </div>

                        <button
                            onClick={connectToPC}
                            disabled={isConnecting || pinCode.length !== 6}
                            className="w-full py-4 rounded-2xl bg-accent text-slate-950 font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                        >
                            {isConnecting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <MonitorPlay className="w-5 h-5" />}
                            {isConnecting ? 'Connecting...' : 'Connect to PC'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col font-sans fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.05),transparent_30%)] pointer-events-none" />

            {/* Header */}
            <div className="glass pt-12 pb-4 px-6 border-b border-white/5 relative z-10 shrink-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                            <MonitorPlay className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-white font-bold leading-none">PC Connected</h2>
                            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Live Sync Active</p>
                        </div>
                    </div>
                    <button onClick={disconnect} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-400" />
                    </button>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search assets..."
                        className="w-full bg-slate-900/80 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-accent/50"
                    />
                    <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
                </div>
            </div>

            {/* Categories (Horizontal Scroll) */}
            <div className="flex overflow-x-auto px-6 py-4 gap-2 no-scrollbar shrink-0 border-b border-white/5 relative z-10">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-accent text-slate-950' : 'bg-slate-900 border border-white/5 text-slate-400'}`}
                    >
                        {cat === 'all' ? 'All Assets' : cat}
                    </button>
                ))}
            </div>

            {/* Asset Grid */}
            <div className="flex-1 overflow-y-auto px-4 py-4 relative z-10 pb-20">
                <div className="grid grid-cols-2 gap-3">
                    {filteredAssets.map(asset => (
                        <div key={asset.id} className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-lg flex flex-col">
                            <div className="aspect-square bg-slate-950 relative">
                                {/* On mobile, we might not have thumbnails hosted on the net if PC is local, but we can try if P2P allows blob sending, or just show placeholders */}
                                {/* For now, generic placeholder since we only get metadata over json via P2P */}
                                <div className="absolute inset-0 flex flex-col items-center justify-center p-2 opacity-50">
                                    <Box className="w-8 h-8 text-accent/50 mb-2" />
                                    <span className="text-[9px] font-mono text-slate-500 break-all text-center">{asset.id}</span>
                                </div>
                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded border border-white/10 text-[8px] font-bold text-white uppercase tracking-wider">
                                    {asset.type}
                                </div>
                            </div>
                            <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                                <h3 className="text-xs font-bold text-white truncate w-full" title={asset.name}>{asset.name}</h3>
                                {asset.type.toLowerCase().includes('3d') && (
                                    <div className="flex flex-col gap-1.5 p-2 bg-black/40 rounded-xl border border-white/5">
                                        <div className="flex justify-between items-center w-full">
                                            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Mesh Decimator</span>
                                            <span className="text-[8px] font-mono text-accent">{decimations[asset.id] ?? 100}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            step="10"
                                            value={decimations[asset.id] ?? 100}
                                            onChange={(e) => setDecimations(prev => ({ ...prev, [asset.id]: parseInt(e.target.value) }))}
                                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-accent"
                                        />
                                    </div>
                                )}
                                <button
                                    onClick={() => triggerExport(asset)}
                                    className="w-full py-2 bg-accent/10 hover:bg-accent/20 border border-accent/20 rounded-xl flex items-center justify-center gap-2 text-accent transition-all active:scale-95"
                                >
                                    <Send className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-black uppercase tracking-widest">Zap</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                {filteredAssets.length === 0 && (
                    <div className="text-center py-20">
                        <Box className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                        <p className="text-slate-500 text-sm font-bold">No assets found</p>
                    </div>
                )}
            </div>
        </div>
    );
}
