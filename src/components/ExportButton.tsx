'use client';

import { useState, useEffect, useRef } from 'react';
import { Asset } from '@/lib/assets';
import toast from 'react-hot-toast';
import { Send, CheckCircle2, XCircle, Loader2, Layers, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';

interface ExportButtonProps {
    asset: Asset;
    disabled?: boolean;
}

export default function ExportButton({ asset, disabled }: ExportButtonProps) {
    const { user, token } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [resolutions, setResolutions] = useState<string[]>([]);
    const [selectedRes, setSelectedRes] = useState<string>('');
    const [decimation, setDecimation] = useState<number>(100);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const isMounted = useRef(false);

    useEffect(() => {
        isMounted.current = true;

        // Read resolutions directly from cached asset data (populated during library scan)
        const cachedRes = asset.resolutions || [];
        if (cachedRes.length > 0) {
            setResolutions(cachedRes);
            // Prefer 4K if available, otherwise first
            const preferred = cachedRes.includes('4K') ? '4K' : cachedRes[0];
            setSelectedRes(preferred);
        }

        return () => {
            isMounted.current = false;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [asset.resolutions]);

    const handleExport = async () => {
        if (loading || disabled) return;

        setLoading(true);
        setStatus('idle');

        const exportPromise = fetch('/api/assets/export', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ ...asset, selectedResolution: selectedRes, decimation: decimation / 100.0 }),
        }).then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Export failed: ' + res.statusText);
            return data;
        });

        toast.promise(exportPromise, {
            loading: t('lib.export_loading').replace('{name}', asset.name).replace('{res}', selectedRes),
            success: <b>{t('lib.export_success')}</b>,
            error: (err) => <b>{err.toString()}</b>,
        });

        try {
            await exportPromise;
            if (!isMounted.current) return;
            setStatus('success');
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                if (isMounted.current) setStatus('idle');
            }, 3000);
        } catch (error) {
            if (!isMounted.current) return;
            console.error(error);
            setStatus('error');
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = setTimeout(() => {
                if (isMounted.current) setStatus('idle');
            }, 3000);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Resolution Selector */}
            <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 gap-0.5 backdrop-blur-md">
                {Array.from(new Set(['1K', '2K', '4K', '8K', ...resolutions])).map(res => {
                    const isAvailable = resolutions.includes(res) || resolutions.length === 0; // If length 0, maybe still loading or fallback
                    const isSelected = selectedRes === res;

                    return (
                        <button
                            key={res}
                            type="button"
                            disabled={!isAvailable && resolutions.length > 0}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                if (isAvailable || resolutions.length === 0) setSelectedRes(res);
                            }}
                            className={`flex-1 py-1 px-2 whitespace-nowrap text-[9px] font-black uppercase tracking-tighter rounded-lg transition-all duration-300 ${isSelected
                                ? 'bg-accent text-white shadow-[0_0_15px_rgba(56,189,248,0.4)]'
                                : isAvailable
                                    ? 'text-accent hover:bg-white/5 cursor-pointer'
                                    : 'text-slate-600 opacity-50 cursor-not-allowed border-none shadow-none pointer-events-none'
                                }`}
                        >
                            {res}
                        </button>
                    );
                })}
            </div>

            {/* Mesh Decimator (WASM Preview / Setting) for 3D Assets */}
            {asset.type.toLowerCase().includes('3d') && (
                <div className="bg-slate-900/60 p-2 rounded-xl border border-white/5 backdrop-blur-md flex items-center justify-between gap-3 group/slider">
                    <div className="flex flex-col flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 group-hover/slider:text-accent transition-colors">Mesh Decimator</span>
                            <span className="text-[9px] font-mono text-slate-300 bg-white/5 px-1 rounded">{decimation}%</span>
                        </div>
                        <input
                            type="range"
                            min="10"
                            max="100"
                            step="10"
                            value={decimation}
                            onChange={(e) => { e.stopPropagation(); setDecimation(parseInt(e.target.value)); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-accent"
                        />
                    </div>
                </div>
            )}

            {/* Export Button */}
            <button
                onClick={(e) => { e.stopPropagation(); handleExport(); }}
                disabled={loading || disabled}
                className={`w-full py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 group/btn ${status === 'success'
                    ? 'bg-green-500/20 border-green-500/50 text-green-400 shadow-[0_0_15px_-3px_rgba(34,197,94,0.3)]'
                    : status === 'error'
                        ? 'bg-red-500/20 border-red-500/50 text-red-400'
                        : disabled
                            ? 'bg-white/10 border-white/10 text-slate-400 cursor-not-allowed saturate-50'
                            : 'bg-accent/10 hover:bg-accent/20 border-accent/20 hover:border-accent text-accent shadow-lg shadow-accent/5'
                    }`}
            >
                {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : status === 'success' ? (
                    <CheckCircle2 className="w-4 h-4" />
                ) : status === 'error' ? (
                    <XCircle className="w-4 h-4" />
                ) : (
                    <Send className={`w-4 h-4 transition-transform ${!disabled && 'group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1'}`} />
                )}

                <span className="tracking-wide">
                    {loading
                        ? t('lib.sending')
                        : status === 'success'
                            ? t('lib.exported')
                            : status === 'error'
                                ? t('lib.failed')
                                : disabled
                                    ? t('lib.offline')
                                    : t('lib.send_btn')}
                </span>
            </button>
        </div >
    );
}
