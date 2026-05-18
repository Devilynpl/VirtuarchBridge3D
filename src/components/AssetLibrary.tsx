'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useInView } from 'react-intersection-observer';
import {
    Activity, AlertCircle, AlertTriangle, ArrowLeft, Book, Box, Bug, Car, Check, ChevronDown, ChevronRight,
    Clock, Columns, Copy, Cpu, Download, FileCode, FileUp, Filter, Folder, FolderOpen, GitBranch, Globe, Grid,
    GripVertical, Image as ImageIcon, Info, LayoutGrid, LayoutList, Leaf, Library, Link2, Loader2, LogOut, Maximize2,
    MessageSquare, Mic, Monitor, Music, PanelLeft, Plus, RefreshCw, Search, Settings, Share2, ShieldAlert, ShoppingCart,
    Smartphone, Square, Terminal, ThumbsUp, Trash2, User, Users, Volume2, VolumeX, Wand2, Wifi, WifiOff, X, Zap,
    Timer, Bell, Calendar as CalendarIcon, Play
} from 'lucide-react';
import radioStations from '@/lib/radioStations.json';
import BatchThumbnailPanel from './BatchThumbnailPanel';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTransfer } from '@/context/TransferContext';
import { useNetwork } from '@/context/NetworkContext';
import toast from 'react-hot-toast';

import AdminCockpit from './AdminCockpit';
import NativeFeatures from './NativeFeatures';
import CommanderPanel from './CommanderPanel';
import BugReportModal from './BugReportModal';
import ChatPanel from './ChatPanel';
import LanguageSwitch from './LanguageSwitch';
import ExportButton from './ExportButton';
import MobileSync from './MobileSync';
import NewAssetModal from './NewAssetModal';
import ActivationModal from './ActivationModal';
import UpdatePanel from './UpdatePanel';
import SellerDashboard from './SellerDashboard';
import { Asset } from '@/lib/assets';
import { ASSET_TAXONOMY } from '@/lib/assetTaxonomy';

// --- Sub-components for Optimization ---

// 1. Independent Log Interceptor (No state, no re-renders)
const LogInterceptor = React.memo(() => {
    const channelRef = useRef<BroadcastChannel | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Create channel once
        const channel = new BroadcastChannel('app-logs');
        channelRef.current = channel;

        const originalLog = console.log;
        const originalWarn = console.warn;
        const originalError = console.error;

        const broadcast = (type: string, args: any[]) => {
            try {
                const message = args.map(arg =>
                    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                ).join(' ');

                channel.postMessage({
                    type,
                    message,
                    time: new Date().toLocaleTimeString()
                });
            } catch (e) { /* silent fail */ }
        };

        console.log = (...args) => { originalLog(...args); broadcast('log', args); };
        console.warn = (...args) => { originalWarn(...args); broadcast('warn', args); };
        console.error = (...args) => { originalError(...args); broadcast('error', args); };

        return () => {
            console.log = originalLog;
            console.warn = originalWarn;
            console.error = originalError;
            channel.close();
        };
    }, []);

    return null;
});
LogInterceptor.displayName = 'LogInterceptor';


const RadioPlayer = React.memo(() => {
    const { language } = useLanguage();
    const stations = (radioStations as any)[language] || radioStations.en;
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [currentStation, setCurrentStation] = useState(stations[0]);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = isMuted ? 0 : volume;
        }
    }, [volume, isMuted]);

    const setupAudioListeners = (audio: HTMLAudioElement) => {
        audio.onwaiting = () => setIsLoading(true);
        audio.oncanplay = () => setIsLoading(false);
        audio.onplaying = () => {
            setIsLoading(false);
            setIsPlaying(true);
        };
        audio.onpause = () => setIsPlaying(false);
        audio.onerror = () => {
            const err = audio.error;
            const msg = `RADIO_ERROR: code=${err?.code || '?'} msg=${err?.message || ''} url=${audio.src}`;
            console.error(msg);
            setIsLoading(false);
            setIsPlaying(false);

            let displayMsg = "Stacja nieosiągalna";
            if (err?.code === 4) displayMsg = "Format nieobsługiwany (Code 4)";
            toast.error(displayMsg, { icon: '🚫' });
        };
    };

    const togglePlay = () => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            setupAudioListeners(audioRef.current);
        }

        if (isPlaying) {
            audioRef.current.pause();
            audioRef.current.src = "";
            audioRef.current.load(); // Clean up buffer
            setIsPlaying(false);
            setIsLoading(false);
        } else {
            setIsLoading(true);
            audioRef.current.src = currentStation.url;
            audioRef.current.load();
            audioRef.current.play().catch(err => {
                console.error("Radio play() promise failed:", err);
                setIsLoading(false);
                setIsPlaying(false);
                toast.error("Błąd startu strumienia");
            });
        }
    };

    const changeStation = (station: any) => {
        if (!station) return;
        setCurrentStation(station);
        if (isPlaying && audioRef.current) {
            setIsLoading(true);
            audioRef.current.src = station.url;
            audioRef.current.load();
            audioRef.current.play().catch(() => setIsLoading(false));
        }
    };

    return (
        <div className="flex items-center gap-2 px-3 py-1 bg-black/40 rounded-lg border border-white/5 h-[30px]">
            <div className="flex items-center gap-2 pr-2 border-r border-white/10">
                <button
                    onClick={togglePlay}
                    disabled={isLoading}
                    className={`p-1 rounded-md transition-all ${isPlaying ? 'bg-accent/20 text-accent' : 'text-slate-400 hover:text-white hover:bg-white/5'} ${isLoading ? 'animate-pulse opacity-50' : ''}`}
                >
                    {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
                </button>
                <div className="group relative flex items-center">
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className="p-1 hover:bg-white/5 rounded-md text-slate-400 hover:text-white"
                    >
                        {isMuted || volume === 0 ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                    </button>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-slate-900 border border-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto shadow-2xl">
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={volume}
                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                            className="w-20 accent-accent"
                        />
                    </div>
                </div>
            </div>

            <select
                value={currentStation.name}
                onChange={(e) => changeStation(stations.find((s: any) => s.name === e.target.value))}
                className="bg-transparent text-[9px] font-bold text-slate-400 focus:outline-none appearance-none cursor-pointer hover:text-slate-200 truncate max-w-[80px]"
            >
                {stations.map((s: any) => (
                    <option key={s.name} value={s.name} className="bg-slate-900 text-white">{s.name}</option>
                ))}
            </select>
        </div>
    );
});
RadioPlayer.displayName = 'RadioPlayer';

const UtilityTools = React.memo(() => {
    const [timerActive, setTimerActive] = useState(false);
    const [timerSeconds, setTimerSeconds] = useState(0);
    const [alarmTime, setAlarmTime] = useState("");
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const timerInterval = useRef<NodeJS.Timeout | null>(null);

    const startTimer = (mins: number) => {
        if (timerInterval.current) clearInterval(timerInterval.current);
        setTimerSeconds(mins * 60);
        setTimerActive(true);
        timerInterval.current = setInterval(() => {
            setTimerSeconds(prev => {
                if (prev <= 1) {
                    clearInterval(timerInterval.current!);
                    setTimerActive(false);
                    toast("Time's up!", { icon: '⏰', duration: 5000 });
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    const stopTimer = () => {
        if (timerInterval.current) clearInterval(timerInterval.current);
        setTimerActive(false);
    };

    useEffect(() => {
        const checkAlarm = setInterval(() => {
            if (alarmTime) {
                const now = new Date();
                const [h, m] = alarmTime.split(':');
                if (now.getHours() === parseInt(h) && now.getMinutes() === parseInt(m) && now.getSeconds() === 0) {
                    toast.success("ALARM!", { icon: '🔔', duration: 10000 });
                }
            }
        }, 1000);
        return () => clearInterval(checkAlarm);
    }, [alarmTime]);

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-lg border border-white/5 h-[30px] group relative">
                <Timer className={`w-3 h-3 ${timerActive ? 'text-accent animate-pulse' : 'text-slate-500'}`} />
                <span className="text-[9px] font-mono text-slate-400">
                    {timerActive ? `${Math.floor(timerSeconds / 60)}:${(timerSeconds % 60).toString().padStart(2, '0')}` : 'Timer'}
                </span>
                <div className="absolute top-full right-0 mt-2 p-3 glass rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto z-50 min-w-[120px] shadow-2xl">
                    <div className="grid grid-cols-2 gap-2">
                        {[1, 5, 10, 30].map(m => (
                            <button key={m} onClick={() => startTimer(m)} className="px-2 py-1 bg-white/5 hover:bg-accent hover:text-slate-950 rounded text-[9px] font-bold transition-all">{m}m</button>
                        ))}
                    </div>
                    {timerActive && (
                        <button onClick={stopTimer} className="w-full mt-2 py-1 bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white rounded text-[9px] font-bold transition-all uppercase">Stop</button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-lg border border-white/5 h-[30px] group relative">
                <Bell className={`w-3 h-3 ${alarmTime ? 'text-amber-500' : 'text-slate-500'}`} />
                <span className="text-[9px] font-mono text-slate-400">{alarmTime || 'Alarm'}</span>
                <div className="absolute top-full right-0 mt-2 p-3 glass rounded-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto z-50 shadow-2xl">
                    <input
                        type="time"
                        value={alarmTime}
                        onChange={(e) => setAlarmTime(e.target.value)}
                        className="bg-slate-900 text-white text-[10px] rounded p-1 border border-white/10 focus:outline-none focus:border-accent"
                    />
                    {alarmTime && (
                        <button onClick={() => setAlarmTime("")} className="w-full mt-2 py-1 bg-white/5 hover:bg-red-500/20 text-red-500 rounded text-[9px] font-bold transition-all">Clear</button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1 bg-black/40 rounded-lg border border-white/5 h-[30px] group relative">
                <CalendarIcon className="w-3 h-3 text-slate-500 group-hover:text-accent transition-colors" />
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{new Date().toLocaleDateString([], { day: '2-digit', month: 'short' })}</span>
                <div className="absolute top-full right-0 mt-2 p-4 glass rounded-2xl border border-white/10 opacity-0 group-hover:opacity-100 transition-all pointer-events-none group-hover:pointer-events-auto z-50 shadow-2xl min-w-[200px]">
                    <div className="text-center mb-2 border-b border-white/5 pb-2">
                        <p className="text-xs font-black text-white uppercase tracking-widest">{new Date().toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-[8px] text-slate-500 mb-1 text-center font-bold">
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={`${d}-${i}`}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <div key={d} className={`w-6 h-6 flex items-center justify-center rounded-md text-[9px] ${d === new Date().getDate() ? 'bg-accent text-slate-950 font-black' : 'hover:bg-white/5 text-slate-300'}`}>
                                {d}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});
UtilityTools.displayName = 'UtilityTools';

const SystemStatusHUD = React.memo(() => {
    const [fps, setFps] = useState(60);
    const [ping, setPing] = useState(12);
    const [time, setTime] = useState<Date | null>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        setTime(new Date());
        const timer = setInterval(() => {
            setTime(new Date());
            setFps(prev => Math.max(58, Math.min(62, prev + (Math.random() - 0.5))));
            setPing(prev => Math.max(10, Math.min(25, prev + (Math.random() * 4 - 2))));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    if (!mounted || !time) {
        return <div className="flex items-center gap-4 px-3 py-1 bg-black/40 rounded-lg border border-white/5 opacity-0 pointer-events-none h-[30px] w-[180px]"></div>;
    }

    return (
        <div className="flex items-center gap-4 px-3 py-1 bg-black/40 rounded-lg border border-white/5">
            <div className="flex items-center gap-1.5 min-w-[55px]">
                <Clock className="w-2.5 h-2.5 text-slate-500" />
                <span className="text-[9px] font-mono text-slate-400">{time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex items-center gap-1.5 min-w-[40px]">
                <Activity className="w-2.5 h-2.5 text-emerald-500/50" />
                <span className="text-[9px] font-mono text-slate-400">{Math.round(fps)}<span className="text-[7px] text-slate-600 ml-0.5">FPS</span></span>
            </div>
            <div className="flex items-center gap-1.5 min-w-[35px]">
                <div className="w-1 h-1 rounded-full bg-cyan-500/50" />
                <span className="text-[9px] font-mono text-slate-400">{Math.round(ping)}<span className="text-[7px] text-slate-600 ml-0.5">MS</span></span>
            </div>
        </div>
    );
});

SystemStatusHUD.displayName = 'SystemStatusHUD';

const AssetCard = React.memo(({ asset, blenderConnected, selectedLibraryId, addToCart, t, user, userAssetsInfo, onToggleSale, onChangePrice, token }: {
    asset: Asset,
    blenderConnected: boolean,
    selectedLibraryId: string | null,
    addToCart: (a: Asset) => void,
    t: any,
    user: any,
    token: string | null,
    userAssetsInfo: Record<string, { is_for_sale: boolean, price: number }>,
    onToggleSale: (a: Asset) => void,
    onChangePrice: (a: Asset, price: number) => void
}) => {
    const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number } | null>(null);
    const [versionPanel, setVersionPanel] = React.useState(false);
    const [versions, setVersions] = React.useState<any[]>([]);
    const [versionLoading, setVersionLoading] = React.useState(false);
    const [hasUncommitted, setHasUncommitted] = React.useState(false);
    const [commitMsg, setCommitMsg] = React.useState('');
    const [isCommitting, setIsCommitting] = React.useState(false);
    const router = useRouter();

    const fetchVersions = async () => {
        setVersionLoading(true);
        try {
            const res = await fetch(`/api/assets/version?path=${encodeURIComponent(asset.path)}&id=${encodeURIComponent(asset.id)}`);
            const data = await res.json();
            if (res.ok) {
                setVersions(data.versions || []);
                setHasUncommitted(data.hasUncommitted);
            }
        } catch (e) { }
        setVersionLoading(false);
    };

    const commitVersion = async () => {
        setIsCommitting(true);
        try {
            const res = await fetch('/api/assets/version', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assetPath: asset.path, assetId: asset.id, changes: commitMsg || undefined })
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`v${data.version.version} committed!`);
                setCommitMsg('');
                fetchVersions();
            } else {
                toast.error(data.error || 'Commit failed');
            }
        } catch (e) { toast.error('Commit failed'); }
        setIsCommitting(false);
    };

    React.useEffect(() => {
        if (!contextMenu) return;
        const close = () => setContextMenu(null);
        window.addEventListener('click', close);
        window.addEventListener('contextmenu', close);
        return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close); };
    }, [contextMenu]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({ x: e.clientX, y: e.clientY });
    };

    const { ref, inView } = useInView({
        triggerOnce: true,
        rootMargin: '300px 0px',
    });

    const openInExplorer = async () => {
        setContextMenu(null);
        try {
            await fetch(`/api/assets/open-folder`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: asset.path })
            });
        } catch (e) { console.error('Failed to open folder:', e); }
    };

    const handleAITagging = async () => {
        setContextMenu(null);
        if (!asset.thumbnail || !asset.jsonPath) {
            toast.error('Brak JSON lub miniaturki dla tego assetu');
            return;
        }

        const promise = fetch('/api/assets/ai-tag', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
                assetId: asset.id,
                assetJsonPath: asset.jsonPath,
                thumbnailPath: asset.thumbnail
            })
        }).then(async res => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Błąd AI');
            return data;
        });

        toast.promise(promise, {
            loading: 'AI analizuje obraz i dobiera tagi (Moondream2)...',
            success: (data) => `Dodano tagi: ${data.tags.slice(-5).join(', ')}`,
            error: (err) => `Błąd: ${err.message}`
        });
    };

    return (
        <>
            <div
                onClick={() => router.push(`/asset/${asset.id}`)}
                onContextMenu={handleContextMenu}
                className="matte-card rounded-2xl overflow-hidden group flex flex-col h-full border border-white/5 hover:border-accent/20 transition-all duration-300 cursor-pointer"
            >
                <div ref={ref} className="aspect-square bg-slate-900/50 relative overflow-hidden shrink-0">
                    {asset.thumbnail ? (
                        inView ? (
                            <img
                                src={`/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`}
                                alt={asset.name}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                            />
                        ) : null
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 overflow-hidden">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(56,189,248,0.1),transparent)]" />
                            {asset.type === 'addon' ? (
                                <>
                                    <Zap className="w-12 h-12 text-accent/20 mb-2" />
                                    <div className="text-[10px] font-bold text-accent/40 tracking-widest uppercase">{t('lib.addon_package')}</div>
                                </>
                            ) : (
                                <div className="text-slate-600 font-mono text-[10px]">NO_PREVIEW</div>
                            )}
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300" />

                    {/* Top left Tick out for "My Shop" */}
                    {(!selectedLibraryId || selectedLibraryId === 'my-shop') && user && user.tier !== 'FREE' && (
                        <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
                            <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSale(asset); }}
                                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${userAssetsInfo[asset.id]?.is_for_sale ? 'bg-accent border-accent text-slate-950 shadow-[0_0_10px_rgba(56,189,248,0.5)]' : 'bg-black/40 border-white/20 text-transparent hover:border-accent hover:bg-black/60'}`}
                                title={userAssetsInfo[asset.id]?.is_for_sale ? 'Usuń ze sprzedaży' : 'Wystaw na sprzedaż'}
                            >
                                <Check className="w-3.5 h-3.5" />
                            </button>

                            {/* Price Slider */}
                            {userAssetsInfo[asset.id]?.is_for_sale && (
                                <div
                                    className="glass px-2 py-1.5 rounded-lg border border-accent/30 flex flex-col gap-1 items-center animate-in fade-in zoom-in-95"
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                >
                                    <span className="text-[9px] font-bold text-accent uppercase tracking-wider">Cena: {userAssetsInfo[asset.id]?.price || 1} zł</span>
                                    <input
                                        type="range"
                                        min="1"
                                        max="5"
                                        step="1"
                                        value={userAssetsInfo[asset.id]?.price || 1}
                                        onChange={(e) => onChangePrice(asset, parseInt(e.target.value))}
                                        className="w-16 h-1.5 bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_5px_rgba(56,189,248,0.8)] [&::-webkit-slider-thumb]:rounded-full cursor-pointer focus:outline-none"
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Top right ID */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                        <div className="glass px-2 py-1 rounded-lg text-[10px] font-mono text-slate-300 border border-white/10">
                            {asset.id}
                        </div>
                    </div>
                </div>

                <div className="p-3 flex-1 flex flex-col justify-between min-h-0">
                    <div className="min-h-0">
                        <div className="relative mb-3">
                            <div className="flex justify-between items-center mb-1">
                                <div className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em] flex items-center gap-1.5 group-hover:text-accent transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800 group-hover:bg-accent shadow-sm" />
                                    {t(`type.${asset.type}`)}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                                    {selectedLibraryId && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); addToCart(asset); }}
                                            className="p-1.5 bg-accent/5 hover:bg-accent text-accent hover:text-slate-950 rounded-lg transition-all border border-accent/10 hover:border-accent"
                                            title="Add to Cart"
                                        >
                                            <ShoppingCart className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <h3 className="font-bold text-slate-100 truncate leading-tight group-hover:text-accent transition-colors text-sm" title={asset.name}>
                                {asset.name}
                            </h3>
                        </div>
                        <div className="transition-all duration-300 transform translate-y-0">
                            <ExportButton asset={asset} disabled={!blenderConnected} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed z-[9999] min-w-[200px] py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 animate-in fade-in zoom-in-95 duration-150"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                    <button
                        onClick={openInExplorer}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                    >
                        <FolderOpen className="w-4 h-4 text-accent" />
                        <span>Zobacz w Explorerze</span>
                    </button>
                    <div className="h-px w-full bg-white/5 my-1" />
                    <button
                        onClick={handleAITagging}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
                    >
                        <Wand2 className="w-4 h-4" />
                        <span>AI Auto-Tag (Moondream)</span>
                    </button>
                    <div className="h-px w-full bg-white/5 my-1" />
                    <button
                        onClick={() => { setContextMenu(null); setVersionPanel(true); fetchVersions(); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 transition-colors"
                    >
                        <GitBranch className="w-4 h-4" />
                        <span>Historia wersji (Asset Git)</span>
                    </button>
                </div>
            )}

            {/* Version History Panel */}
            {versionPanel && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setVersionPanel(false)} />
                    <div className="relative w-full max-w-md glass rounded-3xl border border-white/10 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                        {/* Header */}
                        <div className="p-5 border-b border-white/5 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400">
                                    <GitBranch className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-md font-bold text-white truncate max-w-[250px]">{asset.name}</h2>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">Asset Git — Historia wersji</p>
                                </div>
                            </div>
                            <button onClick={() => setVersionPanel(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Timeline */}
                        <div className="flex-1 overflow-y-auto p-5">
                            {versionLoading ? (
                                <div className="text-center py-10"><Loader2 className="w-6 h-6 text-accent animate-spin mx-auto" /></div>
                            ) : versions.length === 0 ? (
                                <div className="text-center py-10">
                                    <GitBranch className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm font-bold">Brak wersji</p>
                                    <p className="text-slate-600 text-xs mt-1">Kliknij "Commit" aby zapisać pierwszą wersję tego assetu.</p>
                                </div>
                            ) : (
                                <div className="relative">
                                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-800" />
                                    {[...versions].reverse().map((v, i) => (
                                        <div key={v.version} className="relative pl-10 pb-5 last:pb-0">
                                            <div className={`absolute left-[11px] top-1.5 w-3 h-3 rounded-full border-2 ${i === 0 ? 'bg-cyan-400 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-slate-900 border-slate-600'}`} />
                                            <div className="bg-slate-800/50 rounded-xl p-3 border border-white/5">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-black uppercase tracking-widest ${i === 0 ? 'text-cyan-400' : 'text-slate-400'}`}>v{v.version}</span>
                                                    <span className="text-[10px] text-slate-500 font-mono">{new Date(v.timestamp).toLocaleString('pl-PL')}</span>
                                                </div>
                                                <p className="text-sm text-white">{v.changes}</p>
                                                <p className="text-[10px] text-slate-500 mt-1 font-mono">by {v.author} · {v.hash}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Commit Section */}
                        {hasUncommitted && (
                            <div className="p-4 border-t border-white/5 shrink-0 space-y-2">
                                <div className="flex items-center gap-2 text-amber-400 text-[10px] font-bold uppercase tracking-widest mb-2">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Wykryto niezacommitowane zmiany
                                </div>
                                <input
                                    type="text"
                                    value={commitMsg}
                                    onChange={(e) => setCommitMsg(e.target.value)}
                                    placeholder="Co zmieniono? np. Poprawione albedo..."
                                    className="w-full bg-slate-900/80 border border-slate-700/50 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                                />
                                <button
                                    onClick={commitVersion}
                                    disabled={isCommitting}
                                    className="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 font-black uppercase tracking-widest text-xs hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}
                                    {isCommitting ? 'Committing...' : 'Commit nowa wersja'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
});

AssetCard.displayName = 'AssetCard';

// 3. Simple Grid Component (Stable)
const AssetGrid = React.memo(({ assets, gridCols, blenderConnected, selectedLibraryId, addToCart, t, user, userAssetsInfo, onToggleSale, onChangePrice, token }: {
    assets: Asset[],
    gridCols: number,
    blenderConnected: boolean,
    selectedLibraryId: string | null,
    addToCart: (a: Asset) => void,
    t: any,
    user: any,
    userAssetsInfo: Record<string, { is_for_sale: boolean, price: number }>,
    onToggleSale: (a: Asset) => void,
    onChangePrice: (a: Asset, price: number) => void,
    token: string | null
}) => {
    // Tailwind dynamic classes must be static to be detected by the compiler
    const gridColsMap: { [key: number]: string } = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'lg:grid-cols-4',
        5: 'lg:grid-cols-5',
        6: 'lg:grid-cols-6',
        7: 'lg:grid-cols-7',
        8: 'lg:grid-cols-8'
    };

    const [visibleCount, setVisibleCount] = React.useState(50);
    const { ref: loadMoreRef, inView } = useInView({
        rootMargin: '400px',
    });

    React.useEffect(() => {
        setVisibleCount(50);
    }, [assets]);

    React.useEffect(() => {
        if (inView && visibleCount < assets.length) {
            setVisibleCount(prev => Math.min(prev + 50, assets.length));
        }
    }, [inView, visibleCount, assets.length]);

    const visibleAssets = assets.slice(0, visibleCount);

    return (
        <div className={`grid grid-cols-2 md:grid-cols-3 ${gridColsMap[gridCols] || 'lg:grid-cols-4'} gap-3 lg:gap-6 p-2 lg:p-4 auto-rows-max`}>
            {visibleAssets.map((asset, index) => (
                <AssetCard
                    key={`${asset.id}-${index}`}
                    asset={asset}
                    blenderConnected={blenderConnected}
                    selectedLibraryId={selectedLibraryId}
                    addToCart={addToCart}
                    t={t}
                    user={user}
                    userAssetsInfo={userAssetsInfo}
                    onToggleSale={onToggleSale}
                    onChangePrice={onChangePrice}
                    token={token}
                />
            ))}
            {visibleCount < assets.length && (
                <div ref={loadMoreRef} className="col-span-full h-24 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-accent" />
                </div>
            )}
        </div>
    );
});
AssetGrid.displayName = 'AssetGrid';

// --- Main Component ---

interface AssetLibraryProps {
    initialAssets: Asset[];
    needsSync?: boolean;
}

export default function AssetLibrary({ initialAssets, needsSync }: AssetLibraryProps) {
    const router = useRouter();
    const { token, user } = useAuth();
    const { t } = useLanguage();
    const { isOnline, isOfflineMode, toggleOfflineMode } = useNetwork();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
    const [blenderStatus, setBlenderStatus] = useState<'online' | 'offline'>('offline');
    const blenderConnected = blenderStatus === 'online';

    const [isChatMode, setIsChatMode] = useState(false); // New Chat State
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const { logout } = useAuth();
    const [isBugReportModalOpen, setIsBugReportModalOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false);
    const [isUpdatePanelOpen, setIsUpdatePanelOpen] = useState(false);
    const [isBatchRenderOpen, setIsBatchRenderOpen] = useState(false);
    const [enableRegistration, setEnableRegistration] = useState(true);
    const [isAdminCockpitOpen, setIsAdminCockpitOpen] = useState(false);
    const [isCommanderOpen, setIsCommanderOpen] = useState(false);

    // Shared Library States
    const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
    const [sharedLibraries, setSharedLibraries] = useState<any[]>([]);
    const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [expandedGroups, setExpandedGroups] = useState<string[]>([]); // To track which accorions are open independently
    const [hasClickedAccordion, setHasClickedAccordion] = useState<boolean>(false);
    const [libraryContextMenu, setLibraryContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
    const [gridCols, setGridCols] = useState<number>(8);
    const { cart, addToCart, removeFromCart, clearCart, checkout, zipCount, clearZips, isProcessing } = useTransfer();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [shareResult, setShareResult] = useState<{ shareId: string; password: string; sharePath: string } | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    const handleShareLink = async () => {
        if (cart.length === 0) { toast.error('Koszyk jest pusty'); return; }
        setIsSharing(true);
        setShareResult(null);
        try {
            const res = await fetch('/api/transfer/share-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ assetIds: cart.map(a => a.id) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Błąd tworzenia linku');
            setShareResult(data);
            toast.success('Share-Link wygenerowany!');
        } catch (err: any) {
            toast.error('Błąd: ' + err.message);
        } finally {
            setIsSharing(false);
        }
    };
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settingsTab, setSettingsTab] = useState<'general' | 'seller'>('general');
    const [libraryPath, setLibraryPath] = useState(process.env.NEXT_PUBLIC_LIBRARY_PATH || '');
    const [unrealPath, setUnrealPath] = useState('');
    const [exportTarget, setExportTarget] = useState('blender');
    const [isSavingPath, setIsSavingPath] = useState(false);
    const [turnStatus, setTurnStatus] = useState<any>(null);
    const [isCheckingTurn, setIsCheckingTurn] = useState(false);
    const [turnUrl, setTurnUrl] = useState('');
    const [turnUser, setTurnUser] = useState('');
    const [turnPass, setTurnPass] = useState('');
    const [userAssetsInfo, setUserAssetsInfo] = useState<Record<string, { is_for_sale: boolean, price: number }>>({});
    const [mobilePin, setMobilePin] = useState<string | null>(null);
    const [contacts, setContacts] = useState<any[]>([]);

    // Software Connection State — starts empty (all greyed out until scan)
    const [activeSoftwares, setActiveSoftwares] = useState<string[]>([]);
    const [softwarePaths, setSoftwarePaths] = useState<Record<string, string | null>>({});
    const [dccScanned, setDccScanned] = useState(false);

    // Auto-detect installed DCC software on mount
    useEffect(() => {
        const detectDCC = async () => {
            try {
                const res = await fetch('/api/settings/detect-dcc');
                if (!res.ok) return;
                const data = await res.json();
                const found: string[] = [];
                const paths: Record<string, string | null> = {};

                for (const soft of data.software) {
                    paths[soft.id] = soft.path;
                    if (soft.found) {
                        found.push(soft.id);
                    }
                }

                setActiveSoftwares(found);
                setSoftwarePaths(paths);
                setDccScanned(true);

                if (found.length > 0) {
                    toast.success(`Auto-detected: ${found.map(id => id.toUpperCase()).join(', ')}`, { icon: '🔍' });
                }
            } catch (e) {
                console.warn('[DCC Scanner] Auto-detect failed:', e);
                setDccScanned(true);
            }
        };

        // Also check saved config for manually set paths
        const loadSavedPaths = async () => {
            try {
                if (!token) return;
                const res = await fetch('/api/settings/config', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) return;
                const { config } = await res.json();
                if (config.dccPaths) {
                    setSoftwarePaths(prev => ({ ...prev, ...config.dccPaths }));
                    const savedActive = Object.entries(config.dccPaths as Record<string, string | null>)
                        .filter(([_, p]) => p !== null)
                        .map(([id]) => id);
                    if (savedActive.length > 0) {
                        setActiveSoftwares(prev => [...new Set([...prev, ...savedActive])]);
                    }
                }
            } catch (e) { }
        };

        detectDCC();
        loadSavedPaths();
    }, [token]);

    const toggleSoftware = async (id: string) => {
        const isCurrentlyActive = activeSoftwares.includes(id);

        if (isCurrentlyActive) {
            // Deactivate
            setActiveSoftwares(prev => prev.filter(s => s !== id));
            toast.success(`${id.toUpperCase()} Disabled`);
        } else {
            // If not found by scanner, ask user to locate it
            if (!softwarePaths[id]) {
                try {
                    const res = await fetch('/api/settings/choose-folder', { method: 'POST' });
                    if (!res.ok) return;
                    const data = await res.json();
                    if (data.path) {
                        setSoftwarePaths(prev => ({ ...prev, [id]: data.path }));
                        setActiveSoftwares(prev => [...prev, id]);
                        toast.success(`${id.toUpperCase()} found at: ${data.path}`, { icon: '✅' });

                        // Save to config
                        if (token) {
                            fetch('/api/settings/config', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                body: JSON.stringify({ dccPaths: { ...softwarePaths, [id]: data.path } })
                            }).catch(() => { });
                        }
                    }
                } catch (e) {
                    toast.error(`Failed to locate ${id.toUpperCase()}`);
                }
            } else {
                // Already has a path (from scan or previous config)
                setActiveSoftwares(prev => [...prev, id]);
                toast.success(`${id.toUpperCase()} Enabled`);
            }
        }
    };



    // Fetch config on mount or when settings open
    useEffect(() => {
        if (isSettingsOpen && token) {
            fetch('/api/settings/config', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => {
                    if (data.config) {
                        if (data.config.libraryPath) setLibraryPath(data.config.libraryPath);
                        if (data.config.unrealPath) setUnrealPath(data.config.unrealPath);
                        if (data.config.exportTarget) setExportTarget(data.config.exportTarget);
                        if (data.config.turnUrl) setTurnUrl(data.config.turnUrl);
                        if (data.config.turnUser) setTurnUser(data.config.turnUser);
                        if (data.config.turnPass) setTurnPass(data.config.turnPass);
                        if (data.config.enableRegistration !== undefined) setEnableRegistration(data.config.enableRegistration);
                    }
                })
                .catch(err => console.error('Failed to load config', err));
        }
    }, [isSettingsOpen, token]);

    const fetchTurnStatus = async () => {
        setIsCheckingTurn(true);
        try {
            const res = await fetch('/api/system/turn-test', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                console.log('[P2P] TURN Status Data:', data);
                setTurnStatus(data);
            } else {
                setTurnStatus({ configured: false, error: 'API unreachable' });
            }
        } catch (err) {
            console.error('Failed to fetch TURN status', err);
            setTurnStatus({ configured: false, error: 'Connection failed' });
        }
        setIsCheckingTurn(false);
    };

    useEffect(() => {
        if (isSettingsOpen && token) {
            fetchTurnStatus();
            // Listen for mobile PIN if it's generated
            const shortId = localStorage.getItem('last_mobile_pin');
            if (shortId) setMobilePin(shortId);
        }
    }, [isSettingsOpen]);

    const fetchContacts = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/contacts', { headers: { Authorization: `Bearer ${token}` } });
            if (res.ok) {
                const data = await res.json();
                setContacts(data.contacts || []);
            }
        } catch (err) {
            console.error('Failed to fetch contacts', err);
        }
    };

    useEffect(() => {
        fetchContacts();
        const interval = setInterval(fetchContacts, 30000);
        return () => clearInterval(interval);
    }, [token]);

    // Fetch user assets info (shop state, price)
    useEffect(() => {
        if (token) {
            fetch('/api/library', { headers: { Authorization: `Bearer ${token}` } })
                .then(res => res.json())
                .then(data => {
                    if (data.assets) {
                        const info: any = {};
                        data.assets.forEach((a: any) => {
                            info[a.asset_id] = { is_for_sale: a.is_for_sale, price: a.price };
                        });
                        setUserAssetsInfo(info);
                    }
                })
                .catch(err => console.error('Failed to load user assets info', err));
        }
    }, [token]);

    const [isSyncing, setIsSyncing] = useState(needsSync || false);
    const [showSyncOverlay, setShowSyncOverlay] = useState(needsSync || false);

    // Auto trigger sync if cache is missing AND user is authenticated
    useEffect(() => {
        if (needsSync && token) {
            syncLibrary();
        }
    }, [needsSync, token]);

    // First Start Enforcement: Open settings if library is empty
    useEffect(() => {
        const hasSeenPrompt = localStorage.getItem('hasSeenLibraryPrompt');
        if (!hasSeenPrompt && !process.env.NEXT_PUBLIC_LIBRARY_PATH && initialAssets.length === 0) {
            setIsSettingsOpen(true);
            localStorage.setItem('hasSeenLibraryPrompt', 'true');
        }
    }, [initialAssets.length]);

    const [selectedAddType, setSelectedAddType] = useState<string>('surface');

    // Use full taxonomy as group definition — replaces hard-coded MAIN_GROUPS
    const MAIN_GROUPS = ASSET_TAXONOMY.map(g => ({
        id: g.id,
        types: g.types,
        icon: (() => {
            // Map group id to icon — fallback to Box
            const iconMap: Record<string, any> = {
                'MATERIALS': Square,
                '3D MODELS': Box,
                '3D PLANTS': Leaf,
                'VEHICLES': Car,
                'CHARACTERS': User,
                'SCENES': ImageIcon,
                'ADDONS': Zap,
                'PROJECT FILES': FileCode,
                'HDRI': Globe,
                'BLUEPRINT': Cpu,
                'SOUND EFFECTS': Volume2,
                'MUSIC': Music,
                'VOICE': Mic,
            };
            return iconMap[g.id] || Box;
        })(),
        addType: g.addType,
        subcategories: g.subcategories,
        color: g.color
    }));

    const openAddModal = (type: string) => {
        setSelectedAddType(type);
        setMobileCameraFile(null);
        setIsNewAssetModalOpen(true);
    };

    const [mobileCameraFile, setMobileCameraFile] = useState<File | null>(null);

    useEffect(() => {
        const handleCommand = (e: any) => {
            const data = e.detail;
            if (data.type === 'NEW_ASSET_PHOTO') {
                try {
                    const byteString = atob(data.base64.split(',')[1]);
                    const mimeString = data.mimeType || 'image/jpeg';
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: mimeString });
                    const photoFile = new File([blob], data.filename || `MobileCapture_${Date.now()}.jpg`, { type: mimeString });

                    setSelectedAddType('surface');
                    setMobileCameraFile(photoFile);
                    setIsNewAssetModalOpen(true);
                } catch (err) {
                    console.error('Failed to parse mobile photo', err);
                }
            } else if (data.type === 'COMMAND') {
                if (data.command === 'NEW_ASSET_MODAL') {
                    setSelectedAddType('surface');
                    setMobileCameraFile(null);
                    setIsNewAssetModalOpen(true);
                } else if (data.command === 'SYNC_LIBRARY') {
                    if (token) {
                        toast.promise(
                            fetch('/api/library/scan', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }),
                            { loading: 'Zdalnie skanuje...', success: 'Przeskanowano', error: 'Błąd skanowania' }
                        );
                    }
                } else if (data.command === 'TOGGLE_SIDEBAR') {
                    setIsSidebarOpen(prev => !prev);
                } else if (data.command === 'GET_LIBRARY' && data.sendBack) {
                    if (initialAssets.length > 0) {
                        data.sendBack({ type: 'LIBRARY_DATA', assets: initialAssets });
                    }
                } else if (data.command === 'EXPORT_ASSET' && data.asset) {
                    // Export the given asset
                    toast.success(`Eksportuje Asset ${data.asset.name} z telefonu`);

                    try {
                        let endpoint = '/api/assets/export';
                        fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                                id: data.asset.id,
                                name: data.asset.name,
                                type: data.asset.type,
                                path: data.asset.path,
                                // Provide default resolution
                                selectedResolution: '2K',
                                jsonPath: data.asset.jsonPath || (data.asset.path + '/' + data.asset.id + '.json')
                            })
                        }).then(async res => {
                            if (!res.ok) {
                                const err = await res.json();
                                toast.error('Blender/Unreal error: ' + err.error);
                            } else {
                                toast.success(`Wysłano ${data.asset.name} pomyślnie`);
                            }
                        }).catch(() => {
                            toast.error('Błąd eksportu');
                        });
                    } catch (e) {
                        console.error('Remote export failed', e);
                    }
                }
            }
        };
        window.addEventListener('mobile_command', handleCommand);
        return () => window.removeEventListener('mobile_command', handleCommand);
    }, [token]);

    const handleCloseNewAssetModal = () => {
        setIsNewAssetModalOpen(false);
        setMobileCameraFile(null);
    };

    // ... sync effect ...
    useEffect(() => {
        if (token && initialAssets.length > 0) {
            const syncLibrary = async () => {
                try {
                    await fetch('/api/library/sync', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify({ assets: initialAssets })
                    });
                } catch (err) {
                    console.error('Failed to sync library');
                }
            };
            syncLibrary();
        }
    }, [token, initialAssets]);

    // Fetch shared libraries
    useEffect(() => {
        if (token) {
            const fetchShared = async () => {
                try {
                    const res = await fetch('/api/library/shared', {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const data = await res.json();
                        setSharedLibraries(data.sharedLibraries);
                    }
                } catch (err) {
                    console.error('Failed to fetch shared libraries');
                }
            };
            fetchShared();
            const interval = setInterval(fetchShared, 15000);
            return () => clearInterval(interval);
        }
    }, [token]);

    // Live Folder Sync (Watchdog Polling)
    const [lastPolledUpdate, setLastPolledUpdate] = useState<number | null>(null);
    useEffect(() => {
        if (!token) return;
        const checkLibraryStatus = async () => {
            try {
                const res = await fetch('/api/library/status');
                if (res.ok) {
                    const data = await res.json();

                    if (lastPolledUpdate && data.lastUpdate && data.lastUpdate > lastPolledUpdate) {
                        toast.success(t('lib.watchdog_event') || 'Folder changes detected! Refreshing library...', { icon: '🔄', id: 'watchdog-toast' });
                        router.refresh(); // Automatically fetches new assets Server Component layout
                    }
                    setLastPolledUpdate(data.lastUpdate || Date.now());
                }
            } catch (e) {
                // Ignore network fails
            }
        };
        const interval = setInterval(checkLibraryStatus, 3000);
        return () => clearInterval(interval);
    }, [lastPolledUpdate, token, router, t]);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const res = await fetch('/api/blender/status');
                const data = await res.json();
                setBlenderStatus(data.connected ? 'online' : 'offline');
            } catch (e) {
                setBlenderStatus('offline');
            }
        };

        checkConnection();
        const interval = setInterval(checkConnection, 5000);
        return () => clearInterval(interval);
    }, []);

    const toggleSection = (id: string) => {
        setCollapsedSections(prev =>
            prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
        );
    };

    const removeLibrary = async (id: string) => {
        try {
            const res = await fetch(`/api/contacts?id=${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                toast.success(t('lib.library_removed') || 'Biblioteka usunięta');
                if (selectedLibraryId === id) setSelectedLibraryId(null);
                // Also trigger an immediate re-fetch of shared libraries
                const req = await fetch('/api/library/shared', { headers: { Authorization: `Bearer ${token}` } });
                if (req.ok) {
                    const data = await req.json();
                    setSharedLibraries(data.sharedLibraries);
                }
            } else {
                toast.error('Failed to remove library');
            }
        } catch (e) {
            toast.error('Network error removing library');
        }
    };

    const syncLibrary = async () => {
        setIsSyncing(true);
        setShowSyncOverlay(true);
        const loadingToast = toast.loading('Synching library assets...');
        try {
            const res = await fetch('/api/library/scan', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || 'Library synched successfully', { id: loadingToast });
                // We could refresh the local assets state here if needed
                // For now, let's just reload to be sure
                router.refresh();
            } else {
                const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
                toast.error(`Sync failed: ${errData.error || 'Check library path in Settings'}`, { id: loadingToast, duration: 8000 });
            }
        } catch (err) {
            toast.error('Network error during sync', { id: loadingToast });
        } finally {
            setIsSyncing(false);
            setShowSyncOverlay(false);
        }
    };

    const updateLibraryPath = async () => {
        if (!libraryPath.trim()) return;
        setIsSavingPath(true);
        try {
            const res = await fetch('/api/settings/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    libraryPath,
                    unrealPath,
                    exportTarget,
                    turnUrl,
                    turnUser,
                    turnPass,
                    enableRegistration
                })
            });

            if (res.ok) {
                toast.success('Library path updated! Syncing assets...');
                // Trigger sync immediately
                await syncLibrary();
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
            } else {
                const data = await res.json();
                toast.error(data.error || 'Failed to update path');
            }
        } catch (err) {
            toast.error('Network error');
        } finally {
            setIsSavingPath(false);
        }
    };

    const activeAssets = useMemo(() => {
        if (!selectedLibraryId || selectedLibraryId === 'my-shop') return initialAssets;
        const lib = sharedLibraries.find(l => l.userId === selectedLibraryId);
        return lib ? (lib.assets as Asset[]) : [];
    }, [selectedLibraryId, initialAssets, sharedLibraries]);

    const filteredAssets = useMemo(() => {
        return activeAssets.filter(asset => {
            // Apply My Shop filter
            if (selectedLibraryId === 'my-shop' && !userAssetsInfo[asset.id]?.is_for_sale) {
                return false;
            }

            const matchesSearch = asset.name.toLowerCase().includes(search.toLowerCase()) ||
                asset.id.toLowerCase().includes(search.toLowerCase()) ||
                (asset.tags?.some(tag => tag.toLowerCase().includes(search.toLowerCase())) ?? false);

            // Group Filtering
            let matchesGroup = true;
            if (selectedGroup !== 'all') {
                const group = MAIN_GROUPS.find(g => g.id === selectedGroup);
                matchesGroup = group ? group.types.includes(asset.type) : true;
            }

            const matchesCategory = selectedCategory === 'all' || asset.categories?.some(c => c.toLowerCase().trim() === selectedCategory);
            return matchesSearch && matchesGroup && matchesCategory;
        });
    }, [activeAssets, search, selectedGroup, selectedCategory, selectedLibraryId, userAssetsInfo]);

    // Pre-calculate categories and counts for ALL groups independently of what is selected
    const allGroupCategories = useMemo(() => {
        const result: Record<string, string[]> = {};
        const globalCounts: Record<string, Record<string, number>> = {};

        for (const group of MAIN_GROUPS) {
            const groupAssets = activeAssets.filter(a => group.types.includes(a.type));
            const catSet = new Set<string>();
            const counts: Record<string, number> = { all: groupAssets.length };

            // 1. Categories from actual assets in library
            groupAssets.forEach(a => {
                a.categories?.forEach(c => {
                    const key = c.toLowerCase().trim();
                    if (key) {
                        catSet.add(key);
                        counts[key] = (counts[key] || 0) + 1;
                    }
                });
            });

            // 2. Inject predefined taxonomy subcategories (id as key)
            //    They get count 0 if no asset present yet, but are always visible
            const taxGroup = ASSET_TAXONOMY.find(g => g.id === group.id);
            if (taxGroup) {
                taxGroup.subcategories.forEach(sub => {
                    if (!catSet.has(sub.id)) {
                        catSet.add(sub.id);
                        counts[sub.id] = counts[sub.id] || 0;
                    }
                    // Also try tag-based matching from existing assets
                    if (sub.tags) {
                        groupAssets.forEach(a => {
                            const names = [a.name, ...(a.categories || [])].join(' ').toLowerCase();
                            if (sub.tags!.some(tag => names.includes(tag.toLowerCase()))) {
                                counts[sub.id] = (counts[sub.id] || 0);
                                // Don't double-count, just ensure it's visible
                            }
                        });
                    }
                });
            }

            const sortedCats = Array.from(catSet).sort((a, b) => {
                const nameA = t(`cat.${a}`).toLowerCase();
                const nameB = t(`cat.${b}`).toLowerCase();
                return nameA.localeCompare(nameB);
            });

            result[group.id] = ['all', ...sortedCats];
            globalCounts[group.id] = counts;
        }

        return { categoriesMap: result, countsMap: globalCounts };
    }, [activeAssets, t, MAIN_GROUPS]);

    // Backward compatibility for filteredAssets
    const categories = useMemo(() => {
        if (selectedGroup === 'all') return [];
        return allGroupCategories.categoriesMap[selectedGroup] || [];
    }, [selectedGroup, allGroupCategories]);

    const flatCategories = useMemo(() => {
        const all = new Set<string>();
        Object.values(allGroupCategories.categoriesMap).forEach((cats: any) => {
            cats.forEach((c: any) => {
                if (c && c !== 'all') all.add(c);
            });
        });
        return Array.from(all).sort();
    }, [allGroupCategories]);

    const missingThumbs = useMemo(() => {
        // Only check assets in MY library (not shared) for thumbnail generation
        // M_ prefix usually IDs our created assets
        return initialAssets.filter(a =>
            a.id.startsWith('M_') &&
            (!a.thumbnail || a.thumbnail.includes('NO_PREVIEW'))
        );
    }, [initialAssets]);

    const onToggleSale = async (asset: Asset) => {
        if (!user || user.tier === 'FREE') return;
        const currentInfo = userAssetsInfo[asset.id] || { is_for_sale: false, price: 0 };
        const newStatus = !currentInfo.is_for_sale;

        // Optimistic update
        setUserAssetsInfo(prev => ({
            ...prev,
            [asset.id]: { ...prev[asset.id], is_for_sale: newStatus }
        }));

        try {
            const res = await fetch('/api/library/shop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ asset_id: asset.id, is_for_sale: newStatus, price: currentInfo.price || 1 })
            });
            if (!res.ok) { throw new Error('Failed to update shop status'); }
            toast.success(newStatus ? 'Dodano do My Shop' : 'Usunięto z My Shop');
        } catch (e) {
            // Revert
            setUserAssetsInfo(prev => ({
                ...prev,
                [asset.id]: currentInfo
            }));
            toast.error('Błąd aktualizacji My Shop');
        }
    };

    const onChangePrice = async (asset: Asset, newPrice: number) => {
        if (!user || user.tier === 'FREE') return;
        const currentInfo = userAssetsInfo[asset.id] || { is_for_sale: false, price: 0 };

        // Optimistic update
        setUserAssetsInfo(prev => ({
            ...prev,
            [asset.id]: { ...prev[asset.id], price: newPrice }
        }));

        try {
            const res = await fetch('/api/library/shop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ asset_id: asset.id, is_for_sale: currentInfo.is_for_sale, price: newPrice })
            });
            if (!res.ok) { throw new Error('Failed to update price'); }
            toast.success('Cena zaktualizowana!');
        } catch (e) {
            // Revert
            setUserAssetsInfo(prev => ({
                ...prev,
                [asset.id]: currentInfo
            }));
            toast.error('Błąd aktualizacji ceny');
        }
    };

    return (
        <div className="h-screen w-screen overflow-hidden bg-black flex flex-col font-sans selection:bg-accent/30">
            <BugReportModal isOpen={isBugReportModalOpen} onClose={() => setIsBugReportModalOpen(false)} />
            <UpdatePanel isOpen={isUpdatePanelOpen} onClose={() => setIsUpdatePanelOpen(false)} />
            <BatchThumbnailPanel
                isOpen={isBatchRenderOpen}
                onClose={() => setIsBatchRenderOpen(false)}
                assets={missingThumbs}
                onSuccess={() => router.refresh()}
            />
            {/* Professional App Top Bar */}
            <div className="h-10 shrink-0 z-50 bg-[#0a0a0b] border-b border-white/10 px-4 flex items-center justify-between select-none shadow-xl">
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <img src="/logo.png" alt="Logo" className="w-5 h-5 object-contain" />
                        <span className="text-[11px] font-black tracking-tight text-white uppercase">3DBRIDGE</span>
                    </div>

                    <div className="h-4 w-[1px] bg-white/10 mx-1" />

                    <div className="flex items-center relative gap-1">
                        {['file', 'edit', 'view', 'connect', 'help'].map((menu) => (
                            <div key={menu} className="relative">
                                <button
                                    onMouseEnter={() => activeMenu && setActiveMenu(menu)}
                                    onClick={() => setActiveMenu(activeMenu === menu ? null : menu)}
                                    className={`px-3 py-1 text-[11px] font-medium rounded transition-all flex items-center gap-1 ${activeMenu === menu ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                >
                                    {t(`menu.${menu}`)}
                                    <ChevronDown className={`w-2.5 h-2.5 transition-transform ${activeMenu === menu ? 'rotate-180' : ''}`} />
                                </button>

                                {activeMenu === menu && (
                                    <div className="absolute top-full left-0 mt-1 w-48 py-1 bg-[#1a1c1e] border border-white/10 rounded-lg shadow-2xl z-[100] animate-in fade-in slide-in-from-top-1 duration-200">
                                        {menu === 'file' && (
                                            <>
                                                <button onClick={() => { openAddModal('surface'); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <FileUp className="w-3.5 h-3.5" /> {t('menu.file_import')}
                                                </button>
                                                <button onClick={() => window.location.reload()} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <RefreshCw className="w-3.5 h-3.5" /> {t('menu.file_sync')}
                                                </button>
                                                <div className="h-[1px] bg-white/5 my-1" />
                                                <button onClick={() => logout()} className="w-full text-left px-3 py-2 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-400/5 flex items-center gap-2">
                                                    <LogOut className="w-3.5 h-3.5" /> {t('menu.file_logout')}
                                                </button>
                                            </>
                                        )}
                                        {menu === 'edit' && (
                                            <button onClick={() => { setIsSettingsOpen(true); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                <Settings className="w-3.5 h-3.5" /> {t('menu.edit_settings')}
                                            </button>
                                        )}
                                        {menu === 'view' && (
                                            <>
                                                <button onClick={() => { setIsChatMode(!isChatMode); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <MessageSquare className="w-3.5 h-3.5" /> {t('menu.view_chat')}
                                                </button>
                                                <button onClick={() => { setIsSidebarOpen(!isSidebarOpen); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <PanelLeft className="w-3.5 h-3.5" /> {t('menu.view_sidebar')}
                                                </button>
                                                <div className="h-[1px] bg-white/5 my-1" />
                                                <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-bold">{t('menu.view_grid')}</div>
                                                {[4, 5, 6].map(cols => (
                                                    <button key={cols} onClick={() => { setGridCols(cols); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center justify-between">
                                                        <span className="flex items-center gap-2">
                                                            {cols === 4 ? <LayoutGrid className="w-3.5 h-3.5" /> : cols === 5 ? <Grid className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5 rotate-90" />}
                                                            {cols} {t('menu.view_grid_items')}
                                                        </span>
                                                        {gridCols === cols && <Check className="w-3 h-3 text-accent" />}
                                                    </button>
                                                ))}
                                            </>
                                        )}
                                        {menu === 'connect' && (
                                            <>
                                                <div className="px-3 py-2 flex items-center justify-between">
                                                    <span className="text-[11px] text-slate-300">{t('menu.connect_status')}</span>
                                                    <div className={`w-2 h-2 rounded-full ${blenderConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'}`} />
                                                </div>
                                                <button onClick={() => window.location.reload()} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <RefreshCw className="w-3.5 h-3.5" /> {t('menu.connect_reconnect')}
                                                </button>
                                            </>
                                        )}
                                        {menu === 'help' && (
                                            <>
                                                <button onClick={() => { setIsBugReportModalOpen(true); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <Bug className="w-3.5 h-3.5" /> {t('menu.help_report_bug') || 'Report Bug'}
                                                </button>
                                                <button onClick={() => { setIsAboutOpen(true); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <Info className="w-3.5 h-3.5" /> {t('menu.help_about')}
                                                </button>
                                                <button onClick={() => { window.open('/console', 'System Console', 'width=900,height=600'); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <Terminal className="w-3.5 h-3.5" /> {t('menu.help_console')}
                                                </button>
                                                <button onClick={() => { window.open('https://megascans.pl', '_blank'); setActiveMenu(null); }} className="w-full text-left px-3 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-2">
                                                    <Book className="w-3.5 h-3.5" /> {t('menu.help_docs')}
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                </div>

                <div className="flex items-center gap-4">
                    {/* Sync Status Recall Button */}
                    {isSyncing && !showSyncOverlay && (
                        <button
                            onClick={() => setShowSyncOverlay(true)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-all animate-pulse shadow-lg
                                ${missingThumbs.length > 0
                                    ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 shadow-yellow-900/10'
                                    : 'bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-blue-900/10'}
                            `}
                            title={missingThumbs.length > 0 ? `${missingThumbs.length} brakujących miniaturek` : "Show Sync Progress"}
                        >
                            {missingThumbs.length > 0
                                ? <AlertCircle className="w-3.5 h-3.5" />
                                : <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            }
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                                {missingThumbs.length > 0 ? 'Wymaga Miniaturek' : 'Syncing...'}
                            </span>
                        </button>
                    )}

                    {/* Batch Render (ThumbsUp) Button */}
                    {!isSyncing && missingThumbs.length > 0 && (
                        <button
                            onClick={() => setIsBatchRenderOpen(true)}
                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/30 transition-all shadow-[0_0_15px_-3px_rgba(234,179,8,0.3)] animate-in fade-in zoom-in-95 duration-300"
                            title="Wygeneruj brakujące miniaturki"
                        >
                            <ThumbsUp className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Generuj Miniaturki</span>
                            <span className="bg-yellow-500 text-slate-950 px-1 rounded text-[8px] font-bold">{missingThumbs.length}</span>
                        </button>
                    )}

                    {/* Cleanup Indicator (Exclamation Triangle) */}
                    {zipCount > 0 && (
                        <button
                            onClick={clearZips}
                            className="flex items-center gap-2 px-3 py-1.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500/20 transition-all animate-pulse"
                            title={`Delete ${zipCount} transfer files`}
                        >
                            <AlertTriangle className="w-4 h-4" />
                            <span className="text-[12px] font-black">{zipCount}</span>
                        </button>
                    )}

                    {/* Cart Button */}
                    <button
                        onClick={() => setIsCartOpen(true)}
                        className={`
                            relative px-4 py-1.5 rounded transition-all duration-300 border flex items-center gap-2
                            ${cart.length > 0
                                ? 'bg-accent/20 text-accent border-accent/20'
                                : 'bg-white/5 text-slate-500 border-white/5 hover:bg-white/10 hover:text-slate-300'}
                        `}
                    >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Cart</span>
                        {cart.length > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                                {cart.length}
                            </span>
                        )}
                    </button>

                    {/* Global Chat Toggle Button */}
                    {user && user.tier !== 'FREE' && (
                        <button
                            onClick={() => {
                                if (!user) {
                                    window.dispatchEvent(new CustomEvent('open-auth-overlay', { detail: { isRegister: true } }));
                                    toast.error('Użytkownik NIEZAREJESTROWANY. Proszę się zalogować.');
                                    return;
                                }
                                if (initialAssets.length === 0) {
                                    toast.error('Biblioteka nie Skanowana. Proszę przeskanować wpierw bibliotekę.');
                                    return;
                                }

                                setIsChatMode(!isChatMode);
                            }}
                            className={`
                                px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-widest transition-all duration-300 border flex items-center gap-2
                                ${isChatMode
                                    ? 'bg-accent/20 text-accent border-accent/20 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                                    : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'}
                            `}
                        >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Chat</span>
                        </button>
                    )}

                    <button
                        onClick={toggleOfflineMode}
                        className={`
                            relative px-3 py-1 pb-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border flex items-center gap-2
                            ${isOfflineMode
                                ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}
                        `}
                    >
                        {isOfflineMode ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
                        <span>{isOfflineMode ? 'Offline' : 'Online'}</span>
                    </button>
                    <LanguageSwitch />
                    <div className="hidden lg:flex items-center gap-4 px-4 py-1.5 rounded-xl bg-white/5 border border-white/10">
                        <RadioPlayer />
                        <UtilityTools />
                        <SystemStatusHUD />



                        <div className="h-4 w-px bg-white/10 mx-1" />

                        <div className="flex items-center gap-3">
                            {!user ? (
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('open-auth-overlay', { detail: { isRegister: true } }))}
                                    className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-slate-950 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-accent/20"
                                >
                                    SIGN IN
                                </button>

                            ) : (
                                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                                    <span className="text-[10px] font-black text-green-400 uppercase tracking-tight">{user.username}</span>
                                </div>
                            )}

                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="p-1.5 hover:bg-white/5 rounded-lg transition-all group"
                                title="Settings"
                            >
                                <Settings className="w-4 h-4 text-slate-500 group-hover:text-accent group-hover:rotate-45 transition-all duration-300" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative">
                {/* Refined Vertical Toolbar (Static) */}
                <div className="hidden lg:flex flex-col gap-1 w-12 shrink-0 items-center py-4 z-40 bg-black">


                    {MAIN_GROUPS.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                            <button
                                key={group.id}
                                onClick={() => {
                                    openAddModal(group.addType);
                                    if (isChatMode) setIsChatMode(false); // Switch back to grid on add
                                }}
                                className="glass group relative flex flex-col items-center justify-start w-10 h-10 hover:h-52 hover:bg-slate-800 transition-all duration-500 rounded-r-xl border border-l-0 border-white/10 bg-slate-950/90 shadow-lg backdrop-blur-md overflow-hidden pt-1"
                                title={`Add ${group.id}`}
                            >
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-accent/10 group-hover:bg-accent/20 transition-colors shrink-0">
                                    <GroupIcon className="w-4 h-4 text-accent" />
                                </div>

                                <div className="overflow-hidden max-h-0 group-hover:max-h-40 transition-all duration-500 flex items-center justify-center pt-2 pb-2">
                                    <span className="text-[8px] font-black text-white uppercase tracking-[0.2em] [writing-mode:vertical-rl] whitespace-nowrap leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                                        {group.id}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Main Scrollable Content Area */}
                <div className="flex-1 h-full overflow-y-auto bg-slate-950 rounded-tl-3xl relative border-l border-t border-white/10 shadow-2xl custom-scrollbar flex flex-col">
                    <div className="min-h-full flex flex-col">
                        {isChatMode ? (
                            <div className="h-full flex flex-col">
                                <ChatPanel />
                            </div>
                        ) : (
                            <>
                                <div className="shrink-0 p-8 pb-4 space-y-6 z-10 bg-slate-950 shadow-xl">
                                    <header className="flex flex-col lg:flex-row items-center justify-between gap-8">
                                        <div className="flex flex-col lg:flex-row items-center gap-8">
                                            <div className="relative overflow-hidden rounded-2xl glass group h-32 flex items-center bg-slate-900/40 shrink-0 border border-white/5">
                                                <video
                                                    src="/brfinal.mp4"
                                                    autoPlay
                                                    loop
                                                    muted
                                                    playsInline
                                                    preload="auto"
                                                    className="h-full w-auto min-w-[180px] object-cover"
                                                    onCanPlay={(e) => (e.currentTarget as HTMLVideoElement).play()}
                                                />
                                            </div>

                                            <div className="flex flex-wrap gap-3 items-center justify-center lg:justify-start">
                                                {[
                                                    { id: 'blender', name: 'Blender', connected: activeSoftwares.includes('blender') },
                                                    { id: 'ue', name: 'Unreal Engine', connected: activeSoftwares.includes('ue') },
                                                    { id: 'c4d', name: 'Cinema 4D', connected: activeSoftwares.includes('c4d') },
                                                    { id: '3ds', name: '3ds Max', connected: activeSoftwares.includes('3ds') },
                                                    { id: 'houdini', name: 'Houdini', connected: activeSoftwares.includes('houdini') },
                                                    { id: 'zbrush', name: 'ZBrush', connected: activeSoftwares.includes('zbrush') },
                                                    { id: 'maya', name: 'Maya', connected: activeSoftwares.includes('maya') }
                                                ].map((plugin) => {
                                                    const exePath = softwarePaths[plugin.id];
                                                    const hasExe = !!exePath;

                                                    const handleLaunch = async () => {
                                                        if (!hasExe) return;
                                                        try {
                                                            const res = await fetch('/api/settings/launch-dcc', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ exePath })
                                                            });
                                                            if (res.ok) {
                                                                toast.success(`${plugin.name} uruchomiony!`, { icon: '🚀' });
                                                            } else {
                                                                const data = await res.json();
                                                                toast.error(data.error || `Nie udało się uruchomić ${plugin.name}`);
                                                            }
                                                        } catch (e) {
                                                            toast.error(`Błąd uruchamiania ${plugin.name}`);
                                                        }
                                                    };

                                                    const handleBrowseExe = async (e: React.MouseEvent) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const res = await fetch('/api/settings/choose-folder', { method: 'POST' });
                                                            if (!res.ok) return;
                                                            const data = await res.json();
                                                            if (data.path) {
                                                                setSoftwarePaths(prev => ({ ...prev, [plugin.id]: data.path }));
                                                                if (!activeSoftwares.includes(plugin.id)) {
                                                                    setActiveSoftwares(prev => [...prev, plugin.id]);
                                                                }
                                                                toast.success(`${plugin.name}: ${data.path}`, { icon: '✅' });
                                                                // Save to config
                                                                if (token) {
                                                                    fetch('/api/settings/config', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                                                                        body: JSON.stringify({ dccPaths: { ...softwarePaths, [plugin.id]: data.path } })
                                                                    }).catch(() => { });
                                                                }
                                                            }
                                                        } catch (e) {
                                                            toast.error(`Nie udało się wskazać ${plugin.name}`);
                                                        }
                                                    };

                                                    return (
                                                        <div key={plugin.id} className="relative group flex flex-col items-center gap-1.5">
                                                            <button
                                                                onClick={() => {
                                                                    if (hasExe) {
                                                                        handleLaunch();
                                                                    } else {
                                                                        handleBrowseExe({ stopPropagation: () => { } } as React.MouseEvent);
                                                                    }
                                                                    setExportTarget(plugin.id);
                                                                }}
                                                                className={`relative h-28 w-28 rounded-2xl flex items-center justify-center transition-all duration-500 overflow-hidden ${exportTarget === plugin.id
                                                                    ? 'scale-110 shadow-[0_0_24px_rgba(56,189,248,0.35)] bg-accent/5 ring-2 ring-accent/40'
                                                                    : plugin.connected
                                                                        ? 'border-2 border-accent/30 bg-accent/5 hover:scale-105'
                                                                        : 'hover:scale-105 opacity-60 border border-white/5 hover:bg-white/5 hover:opacity-100'
                                                                    }`}
                                                                title={hasExe ? `Kliknij aby uruchomić ${plugin.name}\n${exePath}` : `Wskaż plik exe programu ${plugin.name}`}
                                                            >
                                                                <img
                                                                    src={`/buttons/${plugin.id}_${plugin.connected ? 'on' : 'off'}.png`}
                                                                    className="w-full h-full object-contain p-1.5 transition-transform group-hover:scale-110"
                                                                    alt={plugin.name}
                                                                />

                                                                {exportTarget === plugin.id && (
                                                                    <div className="absolute inset-x-0 bottom-0 h-0.5 bg-accent shadow-[0_-2px_8px_rgba(56,189,248,0.8)]" />
                                                                )}

                                                                {plugin.connected && (
                                                                    <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,1)] ring-2 ring-slate-950 animate-pulse" />
                                                                )}

                                                                {/* Launch overlay on hover when exe is set */}
                                                                {hasExe && (
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-2xl">
                                                                        <span className="text-[10px] font-black uppercase tracking-wider text-green-400">▶ URUCHOM</span>
                                                                    </div>
                                                                )}
                                                            </button>

                                                            {/* Label below button */}
                                                            <button
                                                                onClick={handleBrowseExe}
                                                                className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md transition-all whitespace-nowrap ${hasExe
                                                                    ? 'text-green-400/80 hover:text-green-300 hover:bg-green-500/10'
                                                                    : 'text-slate-500 hover:text-accent hover:bg-accent/10 border border-dashed border-slate-700 hover:border-accent/40'
                                                                    }`}
                                                                title={hasExe ? `Zmień ścieżkę: ${exePath}` : `Wskaż plik .exe programu ${plugin.name}`}
                                                            >
                                                                {hasExe ? plugin.name : '🔍 Wyszukaj Exe'}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Status Indicators & Chat */}
                                            <div className="flex items-center gap-4 ml-6 self-center pb-2">
                                                {/* Status Indicators (Compact Bulbs) */}
                                                <div className="flex flex-col gap-3">
                                                    {/* Library Status */}
                                                    <button
                                                        onClick={() => {
                                                            if (initialAssets.length === 0) {
                                                                syncLibrary();
                                                            }
                                                        }}
                                                        className="group relative flex items-center justify-center w-56 h-14 transition-all"
                                                        title={initialAssets.length > 0 ? `READY: ${libraryPath}` : 'Biblioteka Nie Skanowana'}
                                                    >
                                                        <img
                                                            src={initialAssets.length > 0 ? "/lights/ico_lib_yes.png" : "/lights/ico_lib_no.png"}
                                                            className="w-full h-full object-contain"
                                                            alt="Library Status"
                                                        />
                                                        <div className="absolute inset-0 flex items-center pl-16">
                                                            <div className={`font-black uppercase text-[10px] tracking-[0.2em] ${initialAssets.length > 0 ? 'text-green-500' : 'text-red-500 group-hover:text-red-400'}`}>
                                                                {initialAssets.length > 0 ? 'READY' : 'SCAN LIB'}
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {/* User Status */}
                                                    <div className="group relative flex items-center justify-center w-56 h-14 transition-all">
                                                        <img
                                                            src="/lights/ico_user_no.png"
                                                            className="w-full h-full object-contain"
                                                            alt="User Status"
                                                        />
                                                        <div className="absolute inset-0 flex items-center pl-16">
                                                            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] max-w-[120px] truncate">
                                                                {user ? user.username : 'GUEST'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* DCC Bridge Status */}
                                                    <div className="group relative flex items-center justify-center w-56 h-14 transition-all" title="DCC Bridge Engine Status">
                                                        <img
                                                            src={activeSoftwares.length > 0 ? "/lights/ico_exe_yes.png" : "/lights/ico_exe_no.png"}
                                                            className="w-full h-full object-contain"
                                                            alt="Bridge Engine"
                                                        />
                                                        <div className="absolute inset-0 flex items-center pl-16">
                                                            <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${activeSoftwares.length > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                                                                {activeSoftwares.length > 0 ? 'ENGINE ON' : 'ENGINE OFF'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {user && user.tier !== 'FREE' && (
                                                    <>
                                                        <MobileSync />

                                                        {/* Chat Toggle Button */}
                                                        <button
                                                            onClick={() => {
                                                                if (!user) {
                                                                    window.dispatchEvent(new CustomEvent('open-auth-overlay', { detail: { isRegister: true } }));
                                                                    toast.error('Użytkownik NIEZAREJESTROWANY. Proszę się zalogować.');
                                                                    return;
                                                                }
                                                                if (user.tier === 'FREE') {
                                                                    window.dispatchEvent(new CustomEvent('open-activation-modal'));
                                                                    toast.error('Odmowa dostępu. Wymagana licencja INDIE lub STUDIO.');
                                                                    return;
                                                                }
                                                                if (initialAssets.length === 0) {
                                                                    toast.error('Biblioteka nie Skanowana. Proszę przeskanować wpierw bibliotekę.');
                                                                    return;
                                                                }

                                                                setIsChatMode(!isChatMode);
                                                            }}
                                                            className={`
                                                                px-6 h-[80px] rounded-2xl text-[14px] font-black uppercase tracking-widest transition-all duration-300 border flex flex-col justify-center items-center gap-2
                                                                ${isChatMode
                                                                    ? 'bg-accent/20 text-accent border-accent/40 shadow-[0_0_20px_rgba(56,189,248,0.4)]'
                                                                    : initialAssets.length > 0 && user
                                                                        ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)] hover:shadow-[0_0_15px_rgba(34,197,94,0.4)] hover:border-green-400 cursor-pointer'
                                                                        : 'bg-red-500/5 text-red-500/50 border-red-500/20 cursor-not-allowed'}
                                                            `}
                                                        >
                                                            <MessageSquare className="w-6 h-6" />
                                                            <span>Chat</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>

                                        </div>

                                        <div className="flex items-stretch gap-4 shrink-0">
                                            <div className="flex flex-col gap-2 justify-between py-1">
                                                <button
                                                    onClick={() => setIsUpdatePanelOpen(true)}
                                                    className="relative group shrink-0 overflow-hidden h-[72px] w-72 transition-all cursor-pointer"
                                                >
                                                    <img src="/buttons/update_off.png" className="w-full h-full object-contain absolute inset-0 opacity-100 group-hover:opacity-0 transition-opacity duration-200" />
                                                    <img src="/buttons/update_on.png" className="w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-200 relative" />
                                                </button>
                                                <button
                                                    onClick={() => { window.dispatchEvent(new CustomEvent('open-activation-modal')); }}
                                                    className="relative group shrink-0 overflow-hidden h-[72px] w-72 transition-all cursor-pointer"
                                                >
                                                    <img src="/buttons/upgrade_off.png" className="w-full h-full object-contain absolute inset-0 opacity-100 group-hover:opacity-0 transition-opacity duration-200" />
                                                    <img src="/buttons/upgrade_on.png" className="w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-200 relative" />
                                                </button>
                                                <button
                                                    onClick={() => setIsBugReportModalOpen(true)}
                                                    className="relative group shrink-0 overflow-hidden h-[72px] w-72 transition-all cursor-pointer"
                                                >
                                                    <img src="/buttons/bugreport_off.png" className="w-full h-full object-contain absolute inset-0 opacity-100 group-hover:opacity-0 transition-opacity duration-200" />
                                                    <img src="/buttons/bugreport_oon.png" className="w-full h-full object-contain opacity-0 group-hover:opacity-100 transition-opacity duration-200 relative" />
                                                </button>
                                            </div>

                                            {/* Buy Me a Coffee Banner */}
                                            <button
                                                onClick={() => window.open('https://www.buymeacoffee.com/morbidnoizl', '_blank')}
                                                className="relative group shrink-0 overflow-hidden rounded-2xl shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:shadow-cyan-500/20 active:scale-95 border border-white/5"
                                            >
                                                <img
                                                    src="/buy.png"
                                                    alt="Buy Me A Coffee"
                                                    className="h-32 w-auto object-cover group-hover:brightness-110 transition-all"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                            </button>
                                        </div>
                                    </header>

                                    {/* Filter Bar */}
                                    <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between glass p-6 rounded-2xl">
                                        <div className="flex flex-col md:flex-row gap-4 flex-1">
                                            <div className="relative flex-1">
                                                <input
                                                    type="text"
                                                    placeholder={t('search.placeholder')}
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                    className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-2 text-slate-200 focus:outline-none focus:border-accent/50 transition-colors pl-10"
                                                />
                                                <Search className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            {/* Admin Cockpit Trigger */}
                                            <button
                                                onClick={() => setIsAdminCockpitOpen(true)}
                                                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isAdminCockpitOpen ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                title="Admin Cockpit"
                                            >
                                                <Activity className="w-5 h-5" />
                                            </button>

                                            <button
                                                onClick={() => setIsCommanderOpen(true)}
                                                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isCommanderOpen ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)]' : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                title="Norton Commander Clone"
                                            >
                                                <div className="font-mono font-bold text-xs">NC</div>
                                            </button>

                                            <button
                                                onClick={() => setIsSettingsOpen(true)}
                                                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${isSettingsOpen ? 'bg-accent text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.5)]' : 'bg-slate-900/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                title={t('nav.settings')}
                                            >
                                                <Settings className="w-5 h-5" />
                                            </button>

                                            {/* Grid Controls */}
                                            <div className="flex items-center bg-slate-900/50 p-1 rounded-xl border border-slate-700/50 shrink-0">
                                                {[4, 5, 6, 7, 8].map((cols) => (
                                                    <button
                                                        key={cols}
                                                        onClick={() => setGridCols(cols)}
                                                        className={`p-1.5 rounded-lg transition-all ${gridCols === cols ? 'bg-accent text-slate-950 px-3' : 'text-slate-500 hover:text-slate-300'}`}
                                                        title={t('grid.cols_tooltip').replace('{cols}', cols.toString())}
                                                    >
                                                        <div className="flex items-center gap-1.5 ">
                                                            {cols === 4 ? <LayoutGrid className="w-3.5 h-3.5" /> : cols <= 6 ? <Grid className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5 rotate-90" />}
                                                            <span className="text-[10px] font-bold">{cols}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>

                                        </div>
                                    </div>


                                    {/* Main Library Layout */}
                                </div>
                                <div className="flex-1 min-h-0 px-8 pb-0 flex flex-col lg:flex-row gap-8 items-stretch">
                                    {/* Categories Sidebar */}
                                    <>
                                        {isSidebarOpen && (
                                            <div className="fixed inset-0 z-[140] bg-black/60 backdrop-blur-sm lg:hidden animate-in fade-in" onClick={() => setIsSidebarOpen(false)} />
                                        )}
                                        <aside className={`fixed inset-y-0 left-0 z-[150] w-[85vw] max-w-sm bg-slate-950 p-6 pt-20 border-r border-white/10 shadow-2xl overflow-y-auto custom-scrollbar space-y-4 transition-all duration-300 ${isSidebarOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0 pointer-events-none'} lg:static lg:translate-x-0 lg:opacity-100 lg:pointer-events-auto ${!isSidebarOpen ? 'lg:w-0 lg:p-0 lg:overflow-hidden lg:opacity-0 lg:mr-0' : 'lg:w-72 lg:bg-transparent lg:border-none lg:p-0 lg:shadow-none lg:z-auto lg:shrink-0 lg:h-full lg:pr-2 lg:block'}`}>
                                            {/* Library Sections */}
                                            {[
                                                { id: 'my', name: t('lib.my_library'), active: selectedLibraryId === null },
                                                ...(user && user.tier !== 'FREE' ? [{ id: 'my-shop', name: 'My Shop', active: selectedLibraryId === 'my-shop' }] : []),
                                                ...sharedLibraries.map(lib => ({ id: lib.userId, name: `${lib.username}${t('lib.user_library')}`, active: selectedLibraryId === lib.userId }))
                                            ].map(section => (
                                                <div key={section.id} className="matte-card rounded-2xl overflow-hidden border border-white/5">
                                                    <div
                                                        onClick={() => {
                                                            if (section.id === 'my') setSelectedLibraryId(null);
                                                            else setSelectedLibraryId(section.id);
                                                            toggleSection(section.id);
                                                        }}
                                                        onContextMenu={(e) => {
                                                            if (section.id !== 'my' && section.id !== 'my-shop') {
                                                                e.preventDefault();
                                                                setLibraryContextMenu({ x: e.clientX, y: e.clientY, id: section.id });
                                                            }
                                                        }}
                                                        className={`w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-800/40 transition-colors cursor-pointer ${section.active ? 'border-l-2 border-accent' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-4">
                                                                {section.id === 'my' ? <Library className={`w-8 h-8 ${section.active ? 'text-accent' : 'text-slate-500'}`} /> : section.id === 'my-shop' ? <ShoppingCart className={`w-8 h-8 ${section.active ? 'text-accent' : 'text-slate-500'}`} /> : <Users className={`w-8 h-8 ${section.active ? 'text-accent' : 'text-slate-500'}`} />}
                                                                <span className={`text-[15px] font-bold tracking-wide ${section.active ? 'text-white' : 'text-slate-500'}`}>{section.name}</span>
                                                            </div>
                                                            {section.id === 'my' && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setIsSettingsOpen(true);
                                                                    }}
                                                                    className="p-1 hover:bg-white/10 rounded-md text-slate-500 hover:text-accent transition-all"
                                                                    title={t('lib.settings_tooltip')}
                                                                >
                                                                    <Settings className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {collapsedSections.includes(section.id) ? <ChevronRight className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
                                                    </div>

                                                    {!collapsedSections.includes(section.id) && (
                                                        <div className="p-2 space-y-1 bg-black/20">
                                                            {MAIN_GROUPS.map(group => {
                                                                const groupId = `${section.id}-${group.id}`;
                                                                const isActiveGroup = section.active && selectedGroup === group.id;
                                                                // Expand if user clicked it, OR if it's the active filtered group (for backward compat without breaking)
                                                                const isExpanded = expandedGroups.includes(groupId) || (section.active && !hasClickedAccordion && selectedGroup === group.id);

                                                                const myGroupCategories = allGroupCategories.categoriesMap[group.id] || [];
                                                                const myGroupCounts = allGroupCategories.countsMap[group.id] || {};
                                                                const GroupIcon = group.icon;

                                                                return (
                                                                    <div key={group.id} className="space-y-0.5">
                                                                        <button
                                                                            onClick={() => {
                                                                                if (section.id === 'my') setSelectedLibraryId(null);
                                                                                else setSelectedLibraryId(section.id);

                                                                                setHasClickedAccordion(true);

                                                                                if (!hasClickedAccordion && section.active && selectedGroup === group.id && expandedGroups.length === 0) {
                                                                                    // It was open by default. User clicks to close it.
                                                                                    // So we just leave expandedGroups alone (so it remains closed).
                                                                                } else {
                                                                                    setExpandedGroups(prev => prev.includes(groupId) ? prev.filter(g => g !== groupId) : [...prev, groupId]);
                                                                                }

                                                                                // Only change filter if they aren't just closing a non-selected accordion
                                                                                if (selectedGroup !== group.id || !isActiveGroup) {
                                                                                    setSelectedGroup(group.id);
                                                                                    setSelectedCategory('all');
                                                                                }
                                                                            }}
                                                                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[12.5px] font-semibold transition-all ${isActiveGroup
                                                                                ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_15px_rgba(250,204,21,0.1)]'
                                                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                                                                        >
                                                                            <div className="flex items-center gap-4">
                                                                                <GroupIcon className={`w-6 h-6 ${isActiveGroup ? 'text-yellow-400' : 'text-slate-500'}`} />
                                                                                <span className="text-[15px]">{t(`group.${group.id.toLowerCase().replace(/ /g, '_')}`)}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                <span className={`text-[11px] font-mono px-1.5 py-0.5 rounded-md ${isActiveGroup ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-slate-500'}`}>{section.id === 'my' ? (myGroupCounts['all'] || 0) : (() => { const lib = sharedLibraries.find(l => l.userId === section.id); const libAssets = lib ? (lib.assets as Asset[]) : []; return libAssets.filter(a => group.types.includes(a.type)).length; })()}</span>
                                                                                {isExpanded ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                                                            </div>
                                                                        </button>

                                                                        {isExpanded && myGroupCategories.length > 0 && (
                                                                            <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-white/5 ml-4">
                                                                                {myGroupCategories.map(cat => (
                                                                                    <button
                                                                                        key={cat}
                                                                                        onClick={() => {
                                                                                            // Make sure library and group are selected to apply filter
                                                                                            if (section.id === 'my') setSelectedLibraryId(null);
                                                                                            else setSelectedLibraryId(section.id);
                                                                                            setSelectedGroup(group.id);
                                                                                            setSelectedCategory(cat);
                                                                                        }}
                                                                                        className={`w-full text-left px-3 py-2.5 rounded-md text-[15px] font-medium transition-all flex items-center justify-between ${selectedCategory === cat && isActiveGroup
                                                                                            ? 'text-white font-bold bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.05)]'
                                                                                            : 'text-slate-400 hover:text-slate-100 hover:bg-white/5'}`}
                                                                                    >
                                                                                        <span>{(() => {
                                                                                            if (cat === 'all') return t('cat.all');
                                                                                            // Try taxonomy label first
                                                                                            const taxGroup = ASSET_TAXONOMY.find(g => g.id === group.id);
                                                                                            const taxSub = taxGroup?.subcategories.find(s => s.id === cat);
                                                                                            if (taxSub) return taxSub.label;
                                                                                            // Then i18n
                                                                                            const i18nKey = `cat.${cat.toLowerCase()}`;
                                                                                            const i18nVal = t(i18nKey);
                                                                                            if (i18nVal !== i18nKey) return i18nVal;
                                                                                            // Fallback: capitalize
                                                                                            return cat.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                                                                        })()}</span>
                                                                                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${selectedCategory === cat && isActiveGroup ? 'bg-white/10 text-white' : (myGroupCounts[cat] || 0) === 0 ? 'bg-white/3 text-slate-700' : 'bg-white/5 text-slate-600'}`}>{myGroupCounts[cat] || 0}</span>
                                                                                    </button>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}


                                        </aside>
                                    </>

                                    {/* Asset Grid */}
                                    <div className="flex-1 w-full relative">

                                        {/* Mobile Floating Library Button */}
                                        <button
                                            onClick={() => setIsSidebarOpen(true)}
                                            className="lg:hidden fixed bottom-6 right-6 z-[130] w-14 h-14 flex items-center justify-center bg-accent text-slate-950 rounded-full shadow-[0_4px_20px_rgba(56,189,248,0.4)] hover:scale-105 active:scale-95 transition-all"
                                            title="Open Library Menu"
                                        >
                                            <Library className="w-6 h-6" />
                                        </button>
                                        <AssetGrid
                                            assets={filteredAssets}
                                            gridCols={gridCols}
                                            blenderConnected={blenderConnected}
                                            selectedLibraryId={selectedLibraryId}
                                            addToCart={addToCart}
                                            t={t}
                                            user={user}
                                            userAssetsInfo={userAssetsInfo}
                                            onToggleSale={onToggleSale}
                                            onChangePrice={onChangePrice}
                                            token={token}
                                        />

                                        {filteredAssets.length === 0 && (
                                            <div className="col-span-full py-32 text-center glass rounded-3xl border border-white/5">
                                                <div className="w-16 h-16 bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                                    <Search className="w-6 h-6 text-slate-600" />
                                                </div>
                                                <h4 className="text-slate-200 text-lg font-semibold mb-2">{t('lib.no_matching')}</h4>
                                                <p className="text-slate-500 text-sm mb-8">{t('lib.clear_filters')}</p>
                                                <button
                                                    onClick={() => { setSearch(''); setSelectedGroup('all'); setSelectedCategory('all'); }}
                                                    className="bg-accent/10 hover:bg-accent/20 text-accent px-8 py-3 rounded-xl text-sm font-semibold transition-all border border-accent/20"
                                                >
                                                    {t('lib.clear_btn')}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Cart Drawer */}
            {
                isCartOpen && (
                    <div className="fixed inset-0 z-[100] flex justify-end">
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setIsCartOpen(false); setShareResult(null); }} />
                        <div className="relative w-full max-w-md bg-slate-900/95 backdrop-blur-xl border-l border-white/10 flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl">
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-accent/10 rounded-xl text-accent">
                                        <ShoppingCart className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-bold text-white">Koszyk</h2>
                                        <p className="text-xs text-slate-500">{cart.length} asset{cart.length !== 1 ? 'ów' : ''}</p>
                                    </div>
                                </div>
                                <button onClick={() => { setIsCartOpen(false); setShareResult(null); }} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            {/* Cart Items */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {cart.length === 0 && (
                                    <div className="text-center py-20">
                                        <ShoppingCart className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500 text-sm font-bold">Koszyk jest pusty</p>
                                        <p className="text-slate-600 text-xs mt-1">Dodaj assety z bibliotek współpracowników.</p>
                                    </div>
                                )}
                                {cart.map(asset => (
                                    <div key={asset.id} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-xl border border-white/5 group">
                                        <div className="w-12 h-12 rounded-lg bg-slate-900 flex items-center justify-center shrink-0 overflow-hidden">
                                            {asset.thumbnail ? (
                                                <img
                                                    src={`/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`}
                                                    alt={asset.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <Box className="w-5 h-5 text-slate-600" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate">{asset.name}</h4>
                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider">{asset.type}</p>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(asset.id)}
                                            className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Share Result */}
                            {shareResult && (
                                <div className="mx-4 mb-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                                        <Link2 className="w-4 h-4" />
                                        Share-Link wygenerowany!
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <input
                                                readOnly
                                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}${shareResult.sharePath}`}
                                                className="flex-1 bg-slate-900/80 border border-slate-700/50 rounded-xl py-2 px-3 text-xs text-white font-mono truncate focus:outline-none"
                                            />
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${shareResult.sharePath}`); toast.success('Link skopiowany!'); }}
                                                className="p-2 bg-accent/10 hover:bg-accent/20 text-accent rounded-xl transition-all border border-accent/20"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 bg-slate-900/80 border border-slate-700/50 rounded-xl py-2 px-3 text-xs text-amber-400 font-mono">
                                                🔑 Hasło: <span className="font-bold select-all">{shareResult.password}</span>
                                            </div>
                                            <button
                                                onClick={() => { navigator.clipboard.writeText(shareResult.password); toast.success('Hasło skopiowane!'); }}
                                                className="p-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-xl transition-all border border-amber-500/20"
                                            >
                                                <Copy className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed">
                                        Wyślij link i hasło współpracownikom. Mogą pobrać paczkę ZIP bez logowania.
                                    </p>
                                </div>
                            )}

                            {/* Footer Actions */}
                            {cart.length > 0 && (
                                <div className="p-4 border-t border-white/5 space-y-2 shrink-0">
                                    <button
                                        onClick={handleShareLink}
                                        disabled={isSharing}
                                        className="w-full py-3 rounded-2xl bg-accent text-slate-950 font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                                    >
                                        {isSharing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Share2 className="w-5 h-5" />}
                                        {isSharing ? 'Generowanie...' : 'Udostępnij jako Share-Link'}
                                    </button>
                                    <button
                                        onClick={() => { clearCart(); setShareResult(null); }}
                                        className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                        Wyczyść koszyk
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )
            }

            {isNewAssetModalOpen && (
                <NewAssetModal
                    isOpen={isNewAssetModalOpen}
                    onClose={() => setIsNewAssetModalOpen(false)}
                    onSuccess={() => router.refresh()}
                    initialType={selectedAddType}
                    existingCategories={flatCategories}
                    initialAlbedo={mobileCameraFile}
                />
            )}
            {isAdminCockpitOpen && <AdminCockpit onClose={() => setIsAdminCockpitOpen(false)} />}
            {isCommanderOpen && <CommanderPanel onClose={() => setIsCommanderOpen(false)} />}

            {/* Settings Modal */}
            {
                isSettingsOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => { setIsSettingsOpen(false); setSettingsTab('general'); }} />
                        <div className={`glass w-full ${settingsTab === 'seller' ? 'max-w-6xl h-[85vh]' : 'max-w-lg'} rounded-3xl overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200 shadow-2xl flex flex-col`}>
                            {/* Modal Header */}
                            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-accent/10 rounded-xl text-accent">
                                            <Settings className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">{settingsTab === 'general' ? t('settings.title') : 'Seller Hub'}</h2>
                                            <p className="text-xs text-slate-500">{settingsTab === 'general' ? t('settings.subtitle') : 'Monitor performance & royalty contracts'}</p>
                                        </div>
                                    </div>

                                    <div className="h-8 w-[1px] bg-white/10 mx-2" />

                                    <div className="flex bg-black/20 p-1 rounded-xl border border-white/5">
                                        <button
                                            onClick={() => setSettingsTab('general')}
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab === 'general' ? 'bg-accent text-slate-950 shadow-lg shadow-accent/20' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            General
                                        </button>
                                        <button
                                            onClick={() => setSettingsTab('seller')}
                                            className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${settingsTab === 'seller' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                        >
                                            Seller Hub
                                        </button>
                                    </div>
                                </div>
                                <button onClick={() => { setIsSettingsOpen(false); setSettingsTab('general'); }} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto">
                                {settingsTab === 'seller' ? (
                                    <div className="p-6 h-full">
                                        <SellerDashboard />
                                    </div>
                                ) : (
                                    <>
                                        <div className="p-6 space-y-6">
                                            {/* Native Features (Visible on Mobile/Tablet usually, but here for demo) */}
                                            <NativeFeatures />

                                            {/* System Settings */}
                                            <div className="space-y-3 pb-6 border-b border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                        <Settings className="w-4 h-4 text-accent" />
                                                        System Settings
                                                    </div>
                                                </div>
                                                
                                                <div className="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white mb-1">User Registration</h4>
                                                        <p className="text-[10px] text-slate-500">Allow new users to create accounts.</p>
                                                    </div>
                                                    <button
                                                        onClick={() => setEnableRegistration(!enableRegistration)}
                                                        className={`w-12 h-6 rounded-full p-1 transition-colors ${enableRegistration ? 'bg-accent' : 'bg-slate-700'}`}
                                                    >
                                                        <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-transform ${enableRegistration ? 'translate-x-6' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('lib.path')}</label>
                                                    <span className="text-[10px] text-slate-500 font-mono">{t('settings.current')}: {process.env.NEXT_PUBLIC_LIBRARY_PATH || t('settings.not_set')}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <input
                                                            type="text"
                                                            value={libraryPath}
                                                            onChange={(e) => setLibraryPath(e.target.value)}
                                                            placeholder={t('settings.path_placeholder')}
                                                            style={{ paddingLeft: '48px' }}
                                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent/50 transition-all"
                                                        />
                                                        <FolderOpen className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if ((window as any).electronAPI) {
                                                                const path = await ((window as any).electronAPI as any).selectFolder();
                                                                if (path) setLibraryPath(path);
                                                            } else {
                                                                try {
                                                                    const res = await fetch('/api/settings/choose-folder');
                                                                    if (res.ok) {
                                                                        const data = await res.json();
                                                                        setLibraryPath(data.path);
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Failed to open folder picker', err);
                                                                }
                                                            }
                                                        }}
                                                        className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-white/10 transition-colors"
                                                        title="Browse for folder"
                                                    >
                                                        <FolderOpen className="w-5 h-5" />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                                    {t('settings.path_hint').split('assetsData.json').map((part: any, i: number, arr: any[]) => (
                                                        <span key={i}>
                                                            {part}
                                                            {i < arr.length - 1 && <code className="text-accent/60">assetsData.json</code>}
                                                        </span>
                                                    ))}
                                                </p>
                                            </div>

                                            <div className="space-y-3 pt-4 border-t border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Target Engine</label>
                                                </div>
                                                <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 gap-1">
                                                    <button
                                                        onClick={() => setExportTarget('blender')}
                                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${exportTarget === 'blender' ? 'bg-accent/20 text-accent border border-accent/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                    >
                                                        Blender
                                                    </button>
                                                    <button
                                                        onClick={() => setExportTarget('unreal')}
                                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${exportTarget === 'unreal' ? 'bg-accent/20 text-accent border border-accent/30' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                    >
                                                        Unreal Engine
                                                    </button>
                                                </div>
                                            </div>

                                            {exportTarget === 'unreal' && (
                                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="flex items-center justify-between">
                                                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Unreal Project Path</label>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <input
                                                                type="text"
                                                                value={unrealPath}
                                                                onChange={(e) => setUnrealPath(e.target.value)}
                                                                placeholder="Example: C:\Users\User\Documents\Unreal Projects\MyGame"
                                                                style={{ paddingLeft: '48px' }}
                                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl pr-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent/50 transition-all"
                                                            />
                                                            <FolderOpen className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if ((window as any).electronAPI) {
                                                                    const path = await ((window as any).electronAPI as any).selectFolder();
                                                                    if (path) setUnrealPath(path);
                                                                } else {
                                                                    toast.error("Folder picker is only available in the desktop app")
                                                                }
                                                            }}
                                                            className="px-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl border border-white/10 transition-colors"
                                                            title="Browse for Unreal Engine project folder"
                                                        >
                                                            <FolderOpen className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                                        Select the root folder of your Unreal Engine project. Assets will be copied directly into the project's Content folder.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* P2P / TURN Configuration */}
                                        <div className="p-6 border-t border-white/5 bg-slate-900/20">
                                            <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                        <Globe className="w-4 h-4 text-accent" />
                                                        P2P & Relay (TURN)
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isCheckingTurn ? (
                                                            <Loader2 className="w-3 h-3 animate-spin text-slate-500" />
                                                        ) : (
                                                            <button onClick={fetchTurnStatus} className="p-1 hover:bg-white/5 rounded text-slate-500 hover:text-accent transition-colors" title="Check Status Now">
                                                                <RefreshCw className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${turnStatus?.configured ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'}`}>
                                                            {turnStatus?.error ? turnStatus.error : (turnStatus?.configured ? 'Relay Active' : 'STUN Only')}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">TURN Servers</p>
                                                        <p className="text-xl font-black text-white">{turnStatus?.summary?.turn_servers_count || 0}</p>
                                                    </div>
                                                    <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signal Quality</p>
                                                        <p className="text-xl font-black text-white">{turnStatus?.summary?.turn_servers_count > 1 ? 'Solid' : 'Fair'}</p>
                                                    </div>
                                                </div>

                                                <div className="bg-accent/5 border border-accent/10 rounded-2xl p-4 space-y-2">
                                                    <p className="text-[11px] text-slate-300 leading-relaxed">
                                                        Połączenia P2P są chronione przez <strong>Relay fallback</strong>. Jeśli Twój firewall blokuje bezpośrednie połączenia, aplikacja użyje serwerów TURN (PeerJS + OpenRelay).
                                                    </p>
                                                    <div className="flex items-center gap-4 pt-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">PeerJS Cloud</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Metered.ca</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-white/5">
                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Local Sync & P2P Diagnostic</p>
                                                    <div className="grid grid-cols-2 gap-3 mb-4">
                                                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Signaling Port</p>
                                                            <p className="text-sm font-mono text-emerald-400">9010 (Active)</p>
                                                        </div>
                                                        <div className="bg-black/40 border border-white/5 rounded-2xl p-4 space-y-1">
                                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Web Engine</p>
                                                            <p className="text-sm font-mono text-cyan-400">3010 (Active)</p>
                                                        </div>
                                                    </div>

                                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Custom Relay (Advanced)</p>
                                                    <div className="grid grid-cols-1 gap-2">
                                                        <input
                                                            type="text"
                                                            value={turnUrl}
                                                            onChange={(e) => setTurnUrl(e.target.value)}
                                                            placeholder="turn:your-server.com:3478"
                                                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] text-white focus:outline-none focus:border-accent/40"
                                                        />
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <input
                                                                type="text"
                                                                value={turnUser}
                                                                onChange={(e) => setTurnUser(e.target.value)}
                                                                placeholder="Username"
                                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] text-white focus:outline-none focus:border-accent/40"
                                                            />
                                                            <input
                                                                type="password"
                                                                value={turnPass}
                                                                onChange={(e) => setTurnPass(e.target.value)}
                                                                placeholder="Password"
                                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[11px] text-white focus:outline-none focus:border-accent/40"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-4 flex items-center justify-between border-t border-white/5 mt-4 bg-accent/5 -mx-6 px-6 py-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <Smartphone className="w-4 h-4 text-accent" />
                                                            <p className="text-[11px] font-black text-white uppercase tracking-widest">Mobile Pairing PIN</p>
                                                        </div>
                                                        <p className="text-3xl font-mono font-black text-accent tracking-[0.2em]">{mobilePin || '--- ---'}</p>
                                                    </div>
                                                    <div className="text-right flex flex-col items-end gap-2">
                                                        <p className="text-[10px] text-slate-400 leading-relaxed italic max-w-[180px]">
                                                            Use this PIN in the mobile app. This connection is <strong>End-to-End Encrypted</strong>.
                                                        </p>
                                                        <button
                                                            onClick={() => window.open('/mobile', '_blank')}
                                                            className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-[9px] font-bold text-white uppercase tracking-widest transition-all"
                                                        >
                                                            Open Web Remote
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Reorganize Section */}
                                        <div className="p-6 border-t border-white/5 bg-amber-500/5">
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-xs font-bold text-amber-500 uppercase tracking-widest">
                                                    <ShieldAlert className="w-4 h-4" />
                                                    Troubleshooting & Advanced
                                                </div>
                                                <p className="text-[11px] text-slate-500 leading-relaxed">
                                                    Domyślnie 3DBridge używa <span className="text-accent font-bold">wirtualnych folderów</span> i NIE rusza Twoich plików na dysku.
                                                    Jeśli chcesz fizycznie zreorganizować bibliotekę w strukturę kompatybilną z 3DBridge (Surface/, 3D_Assets/, Decals/…), kliknij przycisk poniżej. <span className="text-red-400 font-bold">Ta operacja jest NIEODWRACALNA.</span>
                                                </p>
                                                <button
                                                    onClick={async () => {
                                                        if (!window.confirm('CZY JESTEŚ PEWIEN?\n\nTa operacja FIZYCZNIE przeniesie foldery assetów do nowej struktury katalogów.\n\nSurface → Surfaces/\n3D → 3D_Assets/\nDecal → Decals/\n...\n\nNiemożliwe do cofnięcia! Czy kontynuować?')) return;
                                                        toast.loading('Reorganizacja biblioteki...', { id: 'reorg' });
                                                        try {
                                                            const res = await fetch('/api/library/reorganize', {
                                                                method: 'POST',
                                                                headers: { Authorization: `Bearer ${token}` },
                                                            });
                                                            const data = await res.json();
                                                            if (res.ok) {
                                                                toast.success(`✅ ${data.message}`, { id: 'reorg', duration: 8000 });
                                                            } else {
                                                                toast.error(`Błąd: ${data.error}`, { id: 'reorg' });
                                                            }
                                                        } catch (e) {
                                                            toast.error('Reorganizacja nie powiodła się', { id: 'reorg' });
                                                        }
                                                    }}
                                                    className="w-full py-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-bold text-sm hover:bg-amber-500 hover:text-slate-950 transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Folder className="w-4 h-4" />
                                                    Dostosuj Bibliotekę do 3DBridge
                                                </button>
                                            </div>
                                        </div>

                                        {/* Modal Footer */}
                                        <div className="p-6 bg-black/20 flex gap-3">
                                            <button
                                                onClick={() => setIsSettingsOpen(false)}
                                                className="flex-1 py-3 rounded-2xl text-sm font-bold text-slate-400 hover:bg-white/5 transition-all"
                                            >
                                                {t('settings.cancel')}
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm("ARE YOU SURE? This will permanently delete ALL assets from your library database!")) {
                                                        try {
                                                            const res = await fetch('/api/library', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                                                            if (res.ok) {
                                                                toast.success("Library cleared!");
                                                                window.location.reload();
                                                            }
                                                        } catch (e) { toast.error("Failed to clear library"); }
                                                    }
                                                }}
                                                className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl text-sm font-bold hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Clear Library
                                            </button>
                                            <button
                                                onClick={syncLibrary}
                                                disabled={isSyncing}
                                                className="px-6 py-3 bg-white/5 border border-white/10 text-white rounded-2xl text-sm font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                                            >
                                                {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                                Sync Assets
                                            </button>
                                            <button
                                                onClick={updateLibraryPath}
                                                disabled={isSavingPath || !libraryPath.trim()}
                                                className="flex-1 px-8 py-3 bg-accent text-slate-950 rounded-2xl text-sm font-bold hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] disabled:opacity-80 disabled:saturate-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                            >
                                                {isSavingPath ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                                {t('settings.save')}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
            <ActivationModal />

            {/* Syncing Overlay */}
            {
                showSyncOverlay && (
                    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-end bg-black/90 backdrop-blur-md"
                        style={{
                            backgroundImage: "url('/splash.png')",
                            backgroundSize: "100% 100%",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            paddingBottom: "25px"
                        }}
                    >
                        <div className="h-[60px] flex items-center justify-center mb-[25px]">
                            <div className="cube-spinner">
                                <div></div><div></div><div></div><div></div><div></div><div></div>
                            </div>
                        </div>

                        <div className="w-[85%] h-[110px] bg-black/40 border border-accent/20 rounded-lg p-[10px_15px] overflow-hidden flex flex-col justify-end shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
                            <div className="text-[11px] leading-[1.6] opacity-70 whitespace-nowrap overflow-hidden text-ellipsis animate-in fade-in slide-in-from-bottom-2">
                                <span className="text-green-400 mr-[8px] font-mono">[+0000ms]</span>
                                <span className="text-blue-400 font-bold mr-[8px]">[SYSTEM]</span>
                                Synching Your Library... Complete synchronization relies on local IO bandwidth. Please wait.
                            </div>
                        </div>

                        <button
                            onClick={() => setShowSyncOverlay(false)}
                            className="mt-6 px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold tracking-widest text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                            RUN IN BACKGROUND
                        </button>
                    </div>
                )
            }

            {/* About Modal */}
            {
                isAboutOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsAboutOpen(false)} />
                        <div className="relative animate-in fade-in zoom-in-95 duration-200" style={{
                            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                            border: '1px solid rgba(59, 130, 246, 0.18)',
                            borderRadius: '16px',
                            padding: '2.2rem 2.4rem',
                            maxWidth: '780px',
                            color: '#e2e8f0',
                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 1px rgba(255,255,255,0.06)',
                            backdropFilter: 'blur(10px)',
                            WebkitBackdropFilter: 'blur(10px)',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            margin: '1.5rem auto'
                        }}>
                            <button onClick={() => setIsAboutOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                            <h1 style={{ margin: '0 0 1.1rem', color: '#60a5fa', fontSize: '2.1rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
                                3DBRIDGE <span style={{ color: '#94a3b8', fontSize: '0.9em', fontWeight: 400 }}>(CGI Bridge)</span>
                            </h1>
                            <p style={{ margin: '0 0 1.6rem', fontSize: '1.15rem', color: '#cbd5e1', lineHeight: 1.55 }}>
                                Nowoczesna, autorska aplikacja do zarządzania i eksportowania Megascansów oraz Twoich własnych assetów 3D prosto do Blendera.
                            </p>
                            <div style={{ margin: '2rem 0', padding: '1.4rem', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.12)' }}>
                                <h3 style={{ margin: '0 0 1rem', color: '#93c5fd', fontSize: '1.35rem' }}>Główne możliwości</h3>
                                <ul style={{ margin: 0, paddingLeft: '1.4rem', lineHeight: 1.7, fontSize: '1.05rem', color: '#cbd5e1' }} className="list-disc">
                                    <li>Przeglądanie, wyszukiwanie i kategoryzowanie lokalnych assetów (modele, powierzchnie, rośliny, decale…)</li>
                                    <li>Eksport prosto do Blendera z automatycznym przypisaniem materiałów i poprawną skalą</li>
                                    <li>Czat P2P i społeczność 3D w czasie rzeczywistym (PeerJS / WebRTC)</li>
                                    <li>Wymiana assetów – proś innych lub wysyłaj paczki .zip bezpośrednio przez sieć P2P</li>
                                    <li>Interaktywne podglądy 3D + szybkie generowanie Normal, AO, Displacement w przeglądarce</li>
                                </ul>
                            </div>
                            <div style={{ marginTop: '1.8rem', fontSize: '0.98rem', color: '#94a3b8' }}>
                                <strong style={{ color: '#60a5fa' }}>Technologie:</strong><br />
                                Next.js • React • Electron • Tailwind CSS • PeerJS/WebRTC • Prisma + SQLite / Pocketbase
                            </div>
                            <div style={{ marginTop: '1.8rem', textAlign: 'center', fontSize: '1.1rem', fontWeight: 500, color: '#93c5fd', letterSpacing: '0.5px' }}>
                                Stworzone z myślą o społeczności 3D 🚀
                            </div>
                        </div>
                    </div>
                )
            }



            {/* Shared Library Context Menu */}
            {
                libraryContextMenu && (
                    <div
                        className="fixed z-[100] bg-[#1a1c1e] border border-white/10 rounded-xl shadow-2xl py-1 w-48 animate-in fade-in"
                        style={{ left: libraryContextMenu.x, top: libraryContextMenu.y }}
                    >
                        <button
                            onClick={() => {
                                removeLibrary(libraryContextMenu.id);
                                setLibraryContextMenu(null);
                            }}
                            className="w-full text-left px-4 py-3 text-[13px] font-semibold tracking-wide text-red-400 hover:bg-white/5 hover:text-red-300 flex items-center gap-3 transition-colors outline-none"
                        >
                            <Trash2 className="w-4 h-4" />
                            Usuń Bibliotekę
                        </button>
                    </div>
                )
            }
            {/* Online Users Bottom Bar */}
            {user && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 z-[60] animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="glass flex items-center gap-2 p-1 px-3 rounded-2xl border border-white/10 shadow-2xl backdrop-blur-xl">
                        <div className="flex -space-x-1 overflow-hidden mr-2">
                            {contacts.filter(c => c.is_online).slice(0, 3).map((contact, i) => (
                                <div key={contact.id} className="w-6 h-6 rounded bg-slate-800 border-2 border-[#020617] flex items-center justify-center shrink-0 overflow-hidden" title={contact.username}>
                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                </div>
                            ))}
                            {contacts.filter(c => c.is_online).length > 3 && (
                                <div className="w-6 h-6 rounded-lg bg-accent/20 border-2 border-[#020617] flex items-center justify-center text-[8px] font-black text-accent">
                                    +{contacts.filter(c => c.is_online).length - 3}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                {contacts.filter(c => c.is_online).length} {t('chat.online')}
                            </span>
                        </div>

                        <div className="h-4 w-px bg-white/10 mx-1" />

                        <div className="flex items-center gap-1.5">
                            {contacts.filter(c => !c.is_online).length > 0 && (
                                <span className="text-[10px] font-bold text-slate-500 lowercase tracking-tight opacity-70">
                                    {contacts.filter(c => !c.is_online).length} offline
                                </span>
                            )}
                        </div>

                        <button
                            onClick={() => setIsChatMode(!isChatMode)}
                            className="ml-2 p-1.5 hover:bg-accent/10 rounded-xl text-slate-400 hover:text-accent transition-all group"
                        >
                            <MessageSquare className="w-4 h-4 group-hover:scale-110 duration-200" />
                        </button>
                    </div>
                </div>
            )}
        </div >
    );
}
