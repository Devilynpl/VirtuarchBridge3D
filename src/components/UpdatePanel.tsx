'use client';

import { useState } from 'react';
import { X, Download, RefreshCw, CheckCircle, AlertCircle, Loader2, ExternalLink, Sparkles, ChevronRight } from 'lucide-react';

interface UpdateInfo {
    upToDate: boolean;
    currentVersion: string;
    latestVersion: string;
    releaseDate?: string;
    releaseNotes?: string;
    downloadUrl?: string;
    releasePage?: string;
    message?: string;
    error?: string;
}

interface UpdatePanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function UpdatePanel({ isOpen, onClose }: UpdatePanelProps) {
    const [checking, setChecking] = useState(false);
    const [info, setInfo] = useState<UpdateInfo | null>(null);

    const checkForUpdates = async () => {
        setChecking(true);
        setInfo(null);
        try {
            const res = await fetch('/api/update/check');
            const data = await res.json();
            setInfo(data);
        } catch (e) {
            setInfo({ error: 'Cannot connect to update server. Check your internet connection.', upToDate: false, currentVersion: '?', latestVersion: '?' });
        } finally {
            setChecking(false);
        }
    };

    const formatDate = (iso?: string) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="glass w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                            <Download className="w-4.5 h-4.5 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-100">Aktualizacje</h2>
                            <p className="text-[10px] text-slate-500 font-mono">3D Bridge</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Version info */}
                    <div className="flex items-center justify-between bg-slate-900/50 rounded-2xl px-4 py-3 border border-slate-800">
                        <div>
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Zainstalowana wersja</p>
                            <p className="text-sm font-mono font-bold text-slate-200">v{info?.currentVersion ?? '0.1.0'}</p>
                        </div>
                        {info && !info.upToDate && !info.error && (
                            <div className="text-right">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-green-400 mb-0.5">Dostępna</p>
                                <p className="text-sm font-mono font-bold text-green-300">v{info.latestVersion}</p>
                            </div>
                        )}
                        {info?.upToDate && (
                            <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-bold uppercase tracking-widest">
                                <CheckCircle className="w-4 h-4" />
                                Aktualna
                            </div>
                        )}
                    </div>

                    {/* Check button */}
                    {!info && (
                        <button
                            onClick={checkForUpdates}
                            disabled={checking}
                            className="w-full py-4 rounded-2xl bg-accent text-slate-950 font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 hover:bg-accent/90 active:scale-[0.98] transition-all disabled:opacity-70 shadow-lg shadow-accent/20"
                        >
                            {checking
                                ? <><Loader2 className="w-4 h-4 animate-spin" /> Sprawdzanie...</>
                                : <><RefreshCw className="w-4 h-4" /> Sprawdź czy są dostępne aktualizacje <ChevronRight className="w-4 h-4" /></>
                            }
                        </button>
                    )}

                    {/* Result: checking */}
                    {checking && (
                        <div className="flex flex-col items-center gap-3 py-4 text-slate-400">
                            <Loader2 className="w-8 h-8 animate-spin text-accent" />
                            <p className="text-sm">Łączenie z serwerem aktualizacji...</p>
                            <p className="text-[10px] text-slate-600 font-mono">github.com/releases</p>
                        </div>
                    )}

                    {/* Result: error */}
                    {info?.error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-red-400 mb-1">Błąd połączenia</p>
                                <p className="text-[11px] text-red-300/70">{info.error}</p>
                            </div>
                        </div>
                    )}

                    {/* Result: up to date */}
                    {info?.upToDate && !info.error && (
                        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 flex gap-3">
                            <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-bold text-green-400 mb-1">Masz najnowszą wersję</p>
                                <p className="text-[11px] text-green-300/70">{info.message || 'Żadne aktualizacje nie są dostępne w tej chwili.'}</p>
                            </div>
                        </div>
                    )}

                    {/* Result: update available */}
                    {info && !info.upToDate && !info.error && (
                        <div className="space-y-3">
                            <div className="bg-accent/10 border border-accent/20 rounded-2xl p-4 flex gap-3">
                                <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-accent mb-1">Dostępna aktualizacja!</p>
                                    <p className="text-[11px] text-slate-300">
                                        Wersja <span className="font-mono font-bold text-white">v{info.latestVersion}</span> jest dostępna
                                        {info.releaseDate && <> · wydana {formatDate(info.releaseDate)}</>}
                                    </p>
                                </div>
                            </div>

                            {info.releaseNotes && (
                                <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-4 max-h-32 overflow-y-auto">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Co nowego</p>
                                    <p className="text-[11px] text-slate-400 whitespace-pre-line leading-relaxed">{info.releaseNotes}</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                {info.downloadUrl && (
                                    <a
                                        href={info.downloadUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex-1 py-3 rounded-xl bg-accent text-slate-950 font-black uppercase tracking-widest text-[11px] flex items-center justify-center gap-2 hover:bg-accent/90 active:scale-[0.98] transition-all shadow-lg shadow-accent/20"
                                    >
                                        <Download className="w-4 h-4" />
                                        Pobierz v{info.latestVersion}
                                    </a>
                                )}
                                {info.releasePage && (
                                    <a
                                        href={info.releasePage}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-3 py-3 rounded-xl border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all flex items-center justify-center"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Check again */}
                    {info && (
                        <button
                            onClick={checkForUpdates}
                            disabled={checking}
                            className="w-full py-2.5 rounded-xl border border-slate-700 text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 text-[11px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Sprawdź ponownie
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
