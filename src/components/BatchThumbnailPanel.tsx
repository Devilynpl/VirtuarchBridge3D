'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Play, Camera, Check, Loader2, AlertCircle, RefreshCw, Box, Layers, Image as ImageIcon } from 'lucide-react';
import SpherePreview from './SpherePreview';
import toast from 'react-hot-toast';

interface BatchThumbnailPanelProps {
    isOpen: boolean;
    onClose: () => void;
    assets: any[];
    onSuccess: () => void;
}

export default function BatchThumbnailPanel({ isOpen, onClose, assets, onSuccess }: BatchThumbnailPanelProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [processed, setProcessed] = useState<string[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const canvasCapturerRef = useRef<(() => string) | null>(null);

    // State for the current asset being rendered
    const [activeAsset, setActiveAsset] = useState<any>(null);
    const [previews, setPreviews] = useState<{ albedo?: string; normal?: string; ord?: string }>({});

    useEffect(() => {
        if (isOpen && assets.length > 0 && currentIndex < assets.length) {
            const asset = assets[currentIndex];
            setActiveAsset(asset);

            // Build absolute URLs for textures using the thumbnail API as a proxy
            const base = `/api/assets/thumbnail?path=`;
            const folder = asset.id.startsWith('M_') ? asset.folder : ''; // Assume folder info is in asset

            // This is a simplified logic - in a real app we'd need the exact map paths
            // For now we'll try to find them or fallback
            const albedo = asset.maps?.find((m: any) => m.type === 'albedo')?.uri;
            const normal = asset.maps?.find((m: any) => m.type === 'normal')?.uri;
            const ord = asset.maps?.find((m: any) => m.type === 'ord')?.uri;

            setPreviews({
                albedo: albedo ? `${base}${encodeURIComponent(albedo)}` : undefined,
                normal: normal ? `${base}${encodeURIComponent(normal)}` : undefined,
                ord: ord ? `${base}${encodeURIComponent(ord)}` : undefined
            });
        }
    }, [currentIndex, assets, isOpen]);

    if (!isOpen) return null;

    const handleStartBatch = async () => {
        setIsProcessing(true);
        setProcessed([]);
        setErrors([]);

        for (let i = 0; i < assets.length; i++) {
            setCurrentIndex(i);
            // Wait for 3D preview to settle
            await new Promise(resolve => setTimeout(resolve, 2000));

            try {
                if (!canvasCapturerRef.current) throw new Error('Renderer not ready');

                const base64 = canvasCapturerRef.current();
                const res = await fetch('/api/assets/thumbnail/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        assetPath: assets[i].jsonPath || assets[i].path,
                        base64
                    })
                });

                if (!res.ok) throw new Error('Save failed');
                setProcessed(prev => [...prev, assets[i].id]);
            } catch (err) {
                console.error(err);
                setErrors(prev => [...prev, assets[i].id]);
            }
        }

        setIsProcessing(false);
        toast.success(`Zakończono! Wygenerowano ${processed.length} miniaturek.`);
        onSuccess();
    };

    const currentAsset = assets[currentIndex];
    const progress = ((currentIndex + 1) / assets.length) * 100;

    return (
        <div className="fixed inset-y-0 right-0 z-[100] flex animate-in slide-in-from-right duration-500 ease-out">
            <div className="w-80 bg-slate-950/95 backdrop-blur-xl border-l border-white/10 shadow-2xl flex flex-col h-full">

                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 bg-slate-900/40">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                            <Layers className="w-5 h-5 text-accent" />
                        </div>
                        {!isProcessing && (
                            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-500 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-white uppercase tracking-tight">Render Queue</h2>
                        <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2 mt-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-green-500 animate-pulse' : 'bg-slate-700'}`} />
                            {isProcessing ? 'Przetwarzanie...' : 'Gotowy do renderu'}
                        </p>
                    </div>
                </div>

                <div className="flex-1 p-6 flex flex-col gap-5 overflow-hidden">

                    {/* Compact Rendering Viewport */}
                    <div className="space-y-3">
                        <div className="aspect-square rounded-2xl overflow-hidden glass border border-white/10 relative shadow-2xl bg-black">
                            {activeAsset && previews.albedo ? (
                                <SpherePreview
                                    key={activeAsset.id}
                                    albedoUrl={previews.albedo}
                                    normalUrl={previews.normal}
                                    roughnessUrl={previews.ord}
                                    interactive={false}
                                    onCanvasReady={(capturer) => { canvasCapturerRef.current = capturer; }}
                                />
                            ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-800 gap-3">
                                    <ImageIcon className="w-8 h-8 opacity-20" />
                                    <span className="text-[8px] font-bold uppercase tracking-wider">Preview Engine</span>
                                </div>
                            )}
                            <div className="absolute top-3 left-3 glass px-2 py-1 rounded-lg text-[8px] font-bold text-accent border border-accent/20 flex items-center gap-1.5 backdrop-blur-sm">
                                <Camera className="w-3 h-3" />
                                V-CAM
                            </div>
                        </div>
                        {activeAsset && (
                            <div className="px-1 truncate">
                                <p className="text-[10px] font-black text-white truncate uppercase tracking-wide">{activeAsset.name}</p>
                                <p className="text-[8px] text-slate-500 font-mono truncate">{activeAsset.id}</p>
                            </div>
                        )}
                    </div>

                    {/* Compact Progress */}
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500">
                            <span>Postęp</span>
                            <span className="text-accent">{currentIndex + 1} / {assets.length}</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                            <div
                                className="h-full bg-accent transition-all duration-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* List & Logs - Compact */}
                    <div className="flex-1 min-h-0 glass bg-black/40 rounded-xl border border-white/5 p-3 overflow-y-auto custom-scrollbar font-mono text-[9px]">
                        <div className="space-y-1.5">
                            {assets.map((a, idx) => (
                                <div key={a.id} className={`flex items-center gap-2 ${idx === currentIndex ? 'text-accent' : processed.includes(a.id) ? 'text-green-500' : errors.includes(a.id) ? 'text-red-500' : 'text-slate-600'}`}>
                                    <div className="w-1 h-1 rounded-full bg-current shrink-0" />
                                    <span className="truncate flex-1">{a.name}</span>
                                    {idx === currentIndex && <RefreshCw className="w-2.5 h-2.5 animate-spin" />}
                                    {processed.includes(a.id) && <Check className="w-2.5 h-2.5" />}
                                </div>
                            ))}
                        </div>
                    </div>

                    {!isProcessing ? (
                        <button
                            onClick={handleStartBatch}
                            className="w-full py-3.5 bg-accent text-slate-950 rounded-xl font-bold uppercase tracking-[0.2em] text-[11px] flex items-center justify-center gap-2.5 shadow-lg shadow-accent/10 hover:bg-accent/90 transition-all"
                        >
                            <Play className="w-4 h-4 fill-current" />
                            Renderuj Wszystkie
                        </button>
                    ) : (
                        <div className="py-3.5 border border-white/5 rounded-xl flex items-center justify-center gap-2 text-[11px] text-slate-500 uppercase font-black font-mono">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Rendering...
                        </div>
                    )}
                </div>

                {/* Footer Info */}
                <div className="px-6 py-4 bg-black/60 border-t border-white/5 flex justify-between items-center text-[9px] font-bold text-slate-600 uppercase tracking-tighter">
                    <div className="flex gap-3">
                        <span className="text-green-500/80">S: {processed.length}</span>
                        <span className="text-red-500/80">E: {errors.length}</span>
                    </div>
                    <span>WebGL 2.0</span>
                </div>
            </div>
        </div>
    );
}
