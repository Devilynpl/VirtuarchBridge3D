'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Box, HardDrive, Layers, Package, Cpu, Code2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import SpherePreview from '@/components/SpherePreview';
import ModelPreview, { MeshStats } from '@/components/ModelPreview';

interface FileInfo {
    name: string;
    sizeBytes: number;
    sizeStr: string;
}

export default function AssetPage({ params }: { params: Promise<{ id: string }> }) {
    const router = useRouter();
    const { t } = useLanguage();
    const { id } = React.use(params);
    const [asset, setAsset] = useState<any>(null);
    const [files, setFiles] = useState<FileInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [previewMode, setPreviewMode] = useState<'2D' | '3D'>('2D');
    const [stats, setStats] = useState<MeshStats | null>(null);

    useEffect(() => {
        const fetchAsset = async () => {
            try {
                const res = await fetch(`/api/assets/${id}`);
                if (!res.ok) throw new Error('Asset not found');
                const data = await res.json();
                setAsset(data);

                // Set default preview mode based on type
                if (data.type === '3d' || data.type === 'model' || data.type === 'surface') {
                    setPreviewMode('3D');
                }

                const filesRes = await fetch(`/api/assets/${id}/files`);
                if (filesRes.ok) {
                    const filesData = await filesRes.json();
                    setFiles(filesData.files.sort((a: any, b: any) => b.sizeBytes - a.sizeBytes));
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchAsset();
    }, [id]);

    if (loading) {
        return <div className="p-10 flex items-center justify-center h-full">
            <div className="animate-pulse text-accent">Loading...</div>
        </div>;
    }

    if (!asset) {
        return <div className="p-10 flex flex-col items-center justify-center h-full">
            <h2 className="text-2xl font-bold mb-4">Asset not found</h2>
            <button onClick={() => router.push('/')} className="px-4 py-2 bg-slate-800 rounded-lg hover:bg-slate-700">Go Back</button>
        </div>;
    }

    // Attempt to find URLs for previews
    const albedoMap = asset.maps?.find((m: any) => m.type === 'albedo')?.uri;
    const normalMap = asset.maps?.find((m: any) => m.type === 'normal')?.uri;
    const roughnessMap = asset.maps?.find((m: any) => m.type === 'ord' || m.type === 'roughness')?.uri;
    const displacementMap = asset.maps?.find((m: any) => m.type === 'displacement')?.uri;

    const mkLocalUrl = (uri: string) => `/api/assets/thumbnail?path=${encodeURIComponent(asset.path + '/' + uri)}`;

    const renderPreview = () => {
        if (previewMode === '2D') {
            return (
                <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl relative group">
                    {asset.thumbnail ? (
                        <img
                            src={asset.thumbnail.startsWith('Data') ? `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}&libraryData=true` : `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`}
                            className="w-full h-full object-contain rounded-xl"
                            alt="Preview"
                        />
                    ) : (
                        <Box className="w-16 h-16 text-slate-700" />
                    )}
                </div>
            );
        }

        if (asset.type === 'surface') {
            return (
                <SpherePreview
                    interactive={true}
                    albedoUrl={albedoMap ? mkLocalUrl(albedoMap) : undefined}
                    normalUrl={normalMap ? mkLocalUrl(normalMap) : undefined}
                    roughnessUrl={roughnessMap ? mkLocalUrl(roughnessMap) : undefined}
                    displacementUrl={displacementMap ? mkLocalUrl(displacementMap) : undefined}
                />
            );
        } else if (asset.type === '3d' || asset.type === '3dplant' || asset.type === 'model') {
            const masterFileUri = asset.masterFile || files.find(f => f.name.match(/\.(glb|gltf)$/i))?.name;
            if (masterFileUri && masterFileUri.match(/\.(glb|gltf)$/i)) {
                return <ModelPreview url={mkLocalUrl(masterFileUri)} onStatsUpdate={setStats} />;
            } else if (asset.thumbnail) {
                return <img src={asset.thumbnail.startsWith('Data') ? `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}&libraryData=true` : `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`} className="w-full h-full object-cover rounded-xl" alt="Thumbnail" />;
            }
        }

        // Fallback to thumbnail
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 rounded-xl">
                {asset.thumbnail ? (
                    <img src={asset.thumbnail.startsWith('Data') ? `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}&libraryData=true` : `/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`} className="w-full h-full object-cover rounded-xl opacity-50" alt="Thumbnail" />
                ) : (
                    <Box className="w-16 h-16 text-slate-700" />
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#020617] text-white p-6 relative overflow-hidden flex flex-col">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] pointer-events-none -z-10" />

            {/* Header */}
            <header className="flex items-center gap-4 mb-8">
                <button onClick={() => router.back()} className="p-3 bg-slate-900 rounded-xl hover:bg-slate-800 transition-colors border border-white/5">
                    <ArrowLeft className="w-5 h-5 text-slate-400" />
                </button>
                <div>
                    <h1 className="text-3xl font-black font-sans uppercase tracking-tight">{asset.name}</h1>
                    <div className="flex gap-2 text-sm text-slate-400 mt-1 uppercase tracking-widest font-bold">
                        <span className="text-accent">{t(`type.${asset.type}`) || asset.type}</span>
                        <span>•</span>
                        <span>{asset.categories?.[0] || 'Uncategorized'}</span>
                    </div>
                </div>
            </header>

            <div className="flex gap-8 flex-1 min-h-[500px]">
                {/* Left side preview */}
                <div className="flex-[2] rounded-3xl border border-white/5 bg-black/40 shadow-2xl overflow-hidden glass p-2 flex flex-col relative group/preview">
                    {renderPreview()}

                    {/* Preview Switcher Overlay */}
                    <div className="absolute top-4 right-4 z-20 flex gap-1 p-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 opacity-0 group-hover/preview:opacity-100 transition-opacity">
                        <button
                            onClick={() => setPreviewMode('2D')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === '2D' ? 'bg-accent text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'text-slate-400 hover:text-white'}`}
                        >
                            2D
                        </button>
                        <button
                            onClick={() => setPreviewMode('3D')}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${previewMode === '3D' ? 'bg-accent text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.3)]' : 'text-slate-400 hover:text-white'}`}
                        >
                            3D
                        </button>
                    </div>

                    {stats && previewMode === '3D' && (
                        <div className="absolute bottom-6 left-6 flex gap-4 pointer-events-none">
                            <div className="glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-accent" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-500">Verticles</span>
                                    <span className="text-sm font-black font-mono">{stats.vertices.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="glass px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                                <Box className="w-4 h-4 text-emerald-400" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-slate-500">Triangles</span>
                                    <span className="text-sm font-black font-mono">{stats.triangles.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right side info panel */}
                <div className="flex-[1] flex flex-col gap-6">
                    <div className="glass p-6 rounded-3xl border border-white/5 space-y-4">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 mb-4">
                            <Layers className="w-4 h-4 text-accent" />
                            File Information
                        </h2>

                        <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin pr-2">
                            {files.length === 0 ? (
                                <p className="text-sm text-slate-500">No files found.</p>
                            ) : (
                                files.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {file.name.match(/\.(png|jpg|jpeg|exr|hdr)$/i) ? (
                                                <div className="p-2 bg-blue-500/10 rounded-lg shrink-0"><Box className="w-4 h-4 text-blue-400" /></div>
                                            ) : file.name.match(/\.(fbx|obj|glb|gltf|blend)$/i) ? (
                                                <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0"><Code2 className="w-4 h-4 text-emerald-400" /></div>
                                            ) : (
                                                <div className="p-2 bg-slate-800 rounded-lg shrink-0"><HardDrive className="w-4 h-4 text-slate-400" /></div>
                                            )}
                                            <span className="text-sm font-medium text-slate-300 truncate max-w-[200px]" title={file.name}>{file.name}</span>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-slate-500 shrink-0">{file.sizeStr}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-4 border-t border-slate-800 mt-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase">Total Files</span>
                            <span className="text-sm font-black text-accent">{files.length}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
