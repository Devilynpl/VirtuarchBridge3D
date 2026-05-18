'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { X, Upload, Plus, Loader2, Sparkles, Wand2, Trash2, Camera, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import SpherePreview from './SpherePreview';
import { useLanguage } from '@/context/LanguageContext';
import { ASSET_TAXONOMY } from '@/lib/assetTaxonomy';
import { generateNormalMap, invertNormalMap, generateAOMap, generateDisplacementMap, generateSpecularMap, generateRoughnessMap, packORDMap } from '@/lib/mapgen';

interface NewAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    initialType?: string;
    existingCategories?: string[];
    initialAlbedo?: File | null;
}

export default function NewAssetModal({ isOpen, onClose, onSuccess, initialType, existingCategories, initialAlbedo }: NewAssetModalProps) {
    const { token } = useAuth();
    const { t } = useLanguage();
    const [loading, setLoading] = useState(false);
    const [mainType, setMainType] = useState<'asset' | 'addon'>(initialType === 'addon' ? 'addon' : 'asset');
    const [name, setName] = useState('');

    const [category, setCategory] = useState('');
    const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
    const [type, setType] = useState(initialType && initialType !== 'addon' ? initialType : 'surface');

    // Separate files for Surface textures
    const [albedoFile, setAlbedoFile] = useState<File | null>(null);
    const [normalFile, setNormalFile] = useState<File | null>(null);
    const [ordFile, setOrdFile] = useState<File | null>(null);

    // ORD Divide mode
    const [ordDivided, setOrdDivided] = useState(false);
    const [aoFile, setAoFile] = useState<File | null>(null);
    const [roughnessFile, setRoughnessFile] = useState<File | null>(null);
    const [displacementFile, setDisplacementFile] = useState<File | null>(null);
    const [specularFile, setSpecularFile] = useState<File | null>(null);

    const [genParams, setGenParams] = useState({
        normalStrength: 2.0,
        aoIntensity: 1.5,
        aoBrightness: 1.0,
        roughnessContrast: 0.9,
        roughnessBrightness: 1.0,
        dispStrength: 1.0,
        dispBlur: 1.0,
        specContrast: 1.5,
        specBrightness: 1.0
    });

    // Legacy files for non-surface
    const [files, setFiles] = useState<FileList | null>(null);
    const [genericFile, setGenericFile] = useState<File | null>(null);

    // 3D Model specific state
    const [modelFile, setModelFile] = useState<File | null>(null);
    const [model3dAlbedo, setModel3dAlbedo] = useState<File | null>(null);
    const [model3dNormal, setModel3dNormal] = useState<File | null>(null);
    const [model3dRoughness, setModel3dRoughness] = useState<File | null>(null);
    const [model3dAo, setModel3dAo] = useState<File | null>(null);
    const [model3dPreviews, setModel3dPreviews] = useState<{ albedo?: string; normal?: string; roughness?: string; ao?: string }>({});
    const [previews, setPreviews] = useState<{ albedo?: string; normal?: string; ord?: string; ao?: string; roughness?: string; displacement?: string; specular?: string }>({});
    const [isGenerating, setIsGenerating] = useState({ normal: false, ao: false, disp: false, specular: false, roughness: false, pack: false });
    const [normalIntensity, setNormalIntensity] = useState(1.0);
    const [renderedThumbnail, setRenderedThumbnail] = useState<string | null>(null);
    const [isRenderingThumb, setIsRenderingThumb] = useState(false);

    // Revenue Model State
    const [revenueModel, setRevenueModel] = useState<'STANDARD' | 'DEFERRED'>('STANDARD');

    const canvasCapturerRef = useRef<(() => string) | null>(null);

    const handleRenderThumbnail = useCallback(async () => {
        if (!canvasCapturerRef.current) {
            toast.error(t('modal.preview_not_ready'));
            return;
        }
        setIsRenderingThumb(true);
        try {
            await new Promise(r => setTimeout(r, 150));
            const dataUrl = canvasCapturerRef.current();
            setRenderedThumbnail(dataUrl);
            toast.success(t('modal.thumb_success'));
        } catch (e) {
            toast.error(t('modal.thumb_error'));
        } finally {
            setIsRenderingThumb(false);
        }
    }, [t]);

    useEffect(() => {
        if (isOpen) {
            if (initialType === 'addon') {
                setMainType('addon');
            } else if (initialType) {
                setMainType('asset');
                setType(initialType);
            }
            setName('');
            setCategory('');
            setFiles(null);
            if (initialAlbedo) {
                setAlbedoFile(initialAlbedo);
                setPreviews({ albedo: URL.createObjectURL(initialAlbedo) });
            } else {
                setAlbedoFile(null);
            }
            setNormalFile(null);
            setOrdFile(null);
            setOrdDivided(false);
            setAoFile(null);
            setRoughnessFile(null);
            setDisplacementFile(null);
            setSpecularFile(null);
            setModelFile(null);
            setModel3dAlbedo(null);
            setModel3dNormal(null);
            setModel3dRoughness(null);
            setModel3dAo(null);
            setModel3dPreviews({});
            setPreviews(initialAlbedo ? { albedo: URL.createObjectURL(initialAlbedo) } : {});
            setRenderedThumbnail(null);
            setNormalIntensity(1.0);
        }
    }, [isOpen, initialType, initialAlbedo]);

    useEffect(() => {
        return () => {
            Object.values(previews).forEach(url => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, [previews]);

    const validateAssetName = useCallback(async (testName: string) => {
        if (!testName.trim()) return testName;
        try {
            const res = await fetch('/api/assets/validate-name', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name: testName, category })
            });
            const data = await res.json();
            if (res.ok) return data.availableName;
        } catch (e) { console.error('Name validation failed', e); }
        return testName;
    }, [token, category]);

    const isGeneric = ['hdri', 'blueprint', 'sfx', 'music', 'voice'].includes(type);

    const handleSaveGeneric = async () => {
        if (!name || !category || !genericFile) {
            toast.error(t('modal.fill_fields'));
            return;
        }
        setLoading(true);
        try {
            const finalName = await validateAssetName(name);
            const fd = new FormData();
            fd.append('name', finalName);
            fd.append('category', category);
            fd.append('type', type);
            fd.append('files', genericFile);
            if (renderedThumbnail) fd.append('renderedThumbnail', renderedThumbnail);
            fd.append('revenueModel', revenueModel);

            const res = await fetch('/api/assets/create', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('modal.asset_success'));
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || t('error.upload'));
            }
        } catch (e) {
            toast.error(t('settings.network_error'));
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const handleSubmit3D = async () => {
        if (!name || !category || !modelFile) {
            toast.error(t('modal.fill_fields'));
            return;
        }
        setLoading(true);
        try {
            const finalName = await validateAssetName(name);
            const fd = new FormData();
            fd.append('name', finalName);
            fd.append('category', category);
            fd.append('type', type);
            fd.append('files', modelFile);
            if (model3dAlbedo) fd.append('files', model3dAlbedo);
            if (model3dNormal) fd.append('files', model3dNormal);
            if (model3dRoughness) fd.append('files', model3dRoughness);
            if (renderedThumbnail) fd.append('renderedThumbnail', renderedThumbnail);
            fd.append('revenueModel', revenueModel);

            const res = await fetch('/api/assets/create', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(t('modal.asset_success'));
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || t('error.upload'));
            }
        } catch (e) {
            toast.error(t('settings.network_error'));
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSurface = async () => {
        if (!name || !category) {
            toast.error(t('modal.fill_fields'));
            return;
        }

        const filesToUpload = [
            { name: 'albedo.png', file: albedoFile },
            { name: 'normal.png', file: normalFile },
            { name: 'ord.png', file: ordFile },
            { name: 'ao.png', file: aoFile },
            { name: 'roughness.png', file: roughnessFile },
            { name: 'displacement.png', file: displacementFile },
            { name: 'specular.png', file: specularFile },
        ].filter(m => m.file !== null);

        if (filesToUpload.length === 0) {
            toast.error(t('modal.no_maps'));
            return;
        }

        setLoading(true);
        try {
            const finalName = await validateAssetName(name);
            const fd = new FormData();
            fd.append('name', finalName);
            fd.append('category', category);
            fd.append('type', type);
            filesToUpload.forEach(m => fd.append('files', m.file as File));

            if (renderedThumbnail) fd.append('renderedThumbnail', renderedThumbnail);
            fd.append('revenueModel', revenueModel);

            const res = await fetch('/api/assets/create', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd
            });

            const data = await res.json();
            if (res.ok) {
                toast.success(t('modal.asset_success'));
                onSuccess();
                onClose();
            } else {
                toast.error(data.error || t('error.upload'));
            }
        } catch (e) {
            toast.error(t('settings.network_error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="glass w-[95vw] max-w-6xl max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">
                <div className="flex items-center justify-between p-6 border-b border-slate-800 shrink-0">
                    <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-accent" />
                        Texture Map Generator & Asset Importer
                    </h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-300 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex p-1 bg-slate-900/80 mx-6 mt-4 rounded-xl border border-slate-800 shrink-0">
                    <button
                        onClick={() => setMainType('asset')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mainType === 'asset' ? 'bg-accent text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {t('modal.asset')}
                    </button>
                    <button
                        onClick={() => setMainType('addon')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mainType === 'addon' ? 'bg-accent text-slate-950 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        {t('modal.addon')}
                    </button>
                </div>

                <div className="p-6 flex-1 min-h-0 flex gap-6">
                    {/* LEFT PANEL - Inputs and Basic Info */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 pr-2 space-y-6">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{t('modal.name')}</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder={mainType === 'addon' ? t('modal.addon_name_placeholder') : t('modal.asset_name_placeholder')}
                                        className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-accent transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">{t('modal.category')}</label>
                                    {!isAddingNewCategory ? (
                                        <select
                                            value={category}
                                            onChange={(e) => {
                                                if (e.target.value === '__add_new__') {
                                                    setIsAddingNewCategory(true);
                                                    setCategory('');
                                                } else {
                                                    setCategory(e.target.value);
                                                }
                                            }}
                                            className="w-full bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-accent/50 transition-colors text-sm appearance-none cursor-pointer"
                                        >
                                            <option value="" disabled>{t('modal.category_placeholder')}</option>
                                            <option value="__add_new__" className="text-accent font-bold">+ {t('lib.add_new_category') || 'Dodaj nową kategorię'}</option>
                                            {(() => {
                                                const currentTaxActionType = mainType === 'addon' ? 'addon' : type;
                                                const currentTaxGroup = ASSET_TAXONOMY.find(g => g.addType === currentTaxActionType);

                                                // Take all taxonomy subcategories, if not found then fallback to existingCategories
                                                if (currentTaxGroup && currentTaxGroup.subcategories.length > 0) {
                                                    return currentTaxGroup.subcategories.map(sub => (
                                                        <option key={sub.id} value={sub.id}>{sub.label}</option>
                                                    ));
                                                }
                                                return existingCategories?.map(cat => (
                                                    <option key={cat} value={cat}>{cat}</option>
                                                ));
                                            })()}
                                        </select>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                required
                                                autoFocus
                                                value={category}
                                                onChange={(e) => setCategory(e.target.value)}
                                                placeholder="Category name..."
                                                className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:border-accent/50 transition-colors text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => { setIsAddingNewCategory(false); setCategory(''); }}
                                                className="px-3 rounded-xl border border-slate-700/50 text-slate-500 hover:text-slate-300"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Revenue Model Selection */}
                            <div className="p-4 bg-accent/5 rounded-2xl border border-white/5 space-y-4 shadow-inner mb-2">
                                <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-accent" />
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-300">
                                        💰 Standard Licencyjny (Revenue Model)
                                    </label>
                                </div>

                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRevenueModel('STANDARD')}
                                        className={`flex-1 py-3.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex flex-col items-center gap-1.5 ${revenueModel === 'STANDARD' ? 'bg-accent text-slate-950 border-accent shadow-lg shadow-accent/20 scale-[1.02]' : 'bg-slate-900/40 text-slate-500 border-white/5 hover:border-white/20'}`}
                                    >
                                        <span>Sprzedaż Klasyczna</span>
                                        <span className="text-[8px] opacity-60 font-bold">(Upfront Payment)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRevenueModel('DEFERRED')}
                                        className={`flex-1 py-3.5 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex flex-col items-center gap-1.5 ${revenueModel === 'DEFERRED' ? 'bg-orange-500 text-white border-orange-400 shadow-lg shadow-orange-500/20 scale-[1.02]' : 'bg-slate-900/40 text-slate-500 border-white/5 hover:border-white/20'}`}
                                    >
                                        <span>Płać Gdy Zarobisz</span>
                                        <span className="text-[8px] opacity-80 font-bold">(Deferred Success)</span>
                                    </button>
                                </div>
                                <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                                    <p className="text-[10px] text-slate-400 leading-relaxed italic text-center">
                                        {revenueModel === 'STANDARD'
                                            ? 'Standardowy model: użytkownik kupuje dostęp do paczki .ass za stałą kwotę przed pobraniem.'
                                            : 'Model partnerski: Artysta pobiera asset za 0zł. System certyfikacji podpisuje umowę na % od zysków gry (po przekroczeniu $50k).'}
                                    </p>
                                </div>
                            </div>

                            {mainType === 'asset' && type === 'surface' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                        <label className="text-sm font-bold uppercase tracking-widest text-slate-400">
                                            Texture Generation & Slots
                                        </label>
                                        <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-700/50">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOrdDivided(false);
                                                    setAoFile(null);
                                                    setRoughnessFile(null);
                                                    setDisplacementFile(null);
                                                    setPreviews(p => ({ ...p, ao: undefined, roughness: undefined, displacement: undefined }));
                                                }}
                                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${!ordDivided ? 'bg-accent/20 border border-accent/40 text-accent shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                ORD (Packed)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOrdDivided(true);
                                                    setOrdFile(null);
                                                    setPreviews(p => ({ ...p, ord: undefined }));
                                                }}
                                                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${ordDivided ? 'bg-orange-500/20 border border-orange-500/40 text-orange-400 shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                            >
                                                3 Separate Maps
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <TextureSlot
                                            label="Albedo"
                                            preview={previews.albedo}
                                            file={albedoFile}
                                            onFileSelect={(f) => {
                                                setAlbedoFile(f);
                                                setPreviews(prev => ({ ...prev, albedo: URL.createObjectURL(f) }));
                                            }}
                                            onClear={() => {
                                                setAlbedoFile(null);
                                                setPreviews(prev => ({ ...prev, albedo: undefined }));
                                            }}
                                        />
                                        <TextureSlot
                                            label="Normal"
                                            preview={previews.normal}
                                            file={normalFile}
                                            onFileSelect={(f) => {
                                                setNormalFile(f);
                                                setPreviews(prev => ({ ...prev, normal: URL.createObjectURL(f) }));
                                            }}
                                            onClear={() => {
                                                setNormalFile(null);
                                                setPreviews(prev => ({ ...prev, normal: undefined }));
                                            }}
                                            tools={(
                                                <>
                                                    {previews.albedo && !previews.normal && (
                                                        <div className="absolute inset-x-0 bottom-0 bg-red-600/90 hover:bg-red-500 transition-all shadow-xl backdrop-blur-sm z-10">
                                                            <button
                                                                type="button"
                                                                disabled={isGenerating.normal}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    setIsGenerating(p => ({ ...p, normal: true }));
                                                                    try {
                                                                        const img = await blobToImage(await (await fetch(previews.albedo!)).blob());
                                                                        const blob = await generateNormalMap(img, genParams.normalStrength);
                                                                        const file = new File([blob], 'normal.png', { type: 'image/png' });
                                                                        setNormalFile(file);
                                                                        setPreviews(p => ({ ...p, normal: URL.createObjectURL(blob) }));
                                                                        toast.success(t('modal.normal_success'));
                                                                    } catch (e) {
                                                                        toast.error(t('modal.normal_error'));
                                                                    } finally {
                                                                        setIsGenerating(p => ({ ...p, normal: false }));
                                                                    }
                                                                }}
                                                                className="w-full py-2.5 flex items-center justify-center text-white font-black uppercase tracking-widest text-[10px]"
                                                            >
                                                                {isGenerating.normal ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
                                                                GENERUJ NORMAL
                                                            </button>
                                                        </div>
                                                    )}
                                                    {previews.normal && (
                                                        <div className="absolute inset-x-0 bottom-0 bg-purple-600/90 hover:bg-purple-500 transition-all shadow-xl backdrop-blur-sm z-10">
                                                            <button
                                                                type="button"
                                                                disabled={isGenerating.normal}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    setIsGenerating(p => ({ ...p, normal: true }));
                                                                    try {
                                                                        const img = await blobToImage(await (await fetch(previews.normal!)).blob());
                                                                        const blob = await invertNormalMap(img);
                                                                        const file = new File([blob], 'normal.png', { type: 'image/png' });
                                                                        setNormalFile(file);
                                                                        setPreviews(p => ({ ...p, normal: URL.createObjectURL(blob) }));
                                                                    } catch (e) { } finally {
                                                                        setIsGenerating(p => ({ ...p, normal: false }));
                                                                    }
                                                                }}
                                                                className="w-full py-2.5 flex items-center justify-center text-white font-black uppercase tracking-widest text-[10px]"
                                                            >
                                                                {isGenerating.normal ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Wand2 className="w-3.5 h-3.5 mr-1.5" />}
                                                                INVERT Y
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        />
                                        <TextureSlot
                                            label="Specular"
                                            preview={previews.specular}
                                            file={specularFile}
                                            onFileSelect={(f) => {
                                                setSpecularFile(f);
                                                setPreviews(prev => ({ ...prev, specular: URL.createObjectURL(f) }));
                                            }}
                                            onClear={() => {
                                                setSpecularFile(null);
                                                setPreviews(prev => ({ ...prev, specular: undefined }));
                                            }}
                                            tools={(
                                                <>
                                                    {roughnessFile && !previews.specular && (
                                                        <div className="absolute inset-x-0 bottom-0 bg-yellow-600/90 hover:bg-yellow-500 transition-all shadow-xl backdrop-blur-sm z-10">
                                                            <button
                                                                type="button"
                                                                disabled={isGenerating.specular}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    setIsGenerating(p => ({ ...p, specular: true }));
                                                                    try {
                                                                        const img = await blobToImage(new Blob([await roughnessFile!.arrayBuffer()]));
                                                                        const blob = await generateSpecularMap(img, genParams.specContrast, genParams.specBrightness);
                                                                        const file = new File([blob], 'specular.png', { type: 'image/png' });
                                                                        setSpecularFile(file);
                                                                        setPreviews(p => ({ ...p, specular: URL.createObjectURL(blob) }));
                                                                        toast.success(t('modal.spec_success'));
                                                                    } catch (e) { toast.error(t('modal.spec_error')); } finally {
                                                                        setIsGenerating(p => ({ ...p, specular: false }));
                                                                    }
                                                                }}
                                                                className="w-full py-2.5 flex items-center justify-center text-white font-black uppercase tracking-widest text-[10px]"
                                                            >
                                                                {isGenerating.specular ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                                                                GENERUJ SPEC
                                                            </button>
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        />

                                        <div className="space-y-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Thumbnail</span>
                                            <div
                                                className={`aspect-square rounded-2xl border-2 overflow-hidden flex items-center justify-center relative transition-all
                                                    ${renderedThumbnail
                                                        ? 'border-green-500/40 bg-slate-900'
                                                        : 'border-dashed border-slate-700/50 bg-slate-900/30'}
                                                `}
                                            >
                                                {renderedThumbnail ? (
                                                    <img src={renderedThumbnail} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="flex flex-col items-center gap-1.5 text-slate-600">
                                                        <Camera className="w-5 h-5" />
                                                        <span className="text-[9px] font-bold text-center leading-tight">Press camera<br />to render</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {!ordDivided ? (
                                        <div className="w-1/4">
                                            <TextureSlot
                                                label="ORD (Packed)"
                                                preview={previews.ord}
                                                file={ordFile}
                                                onFileSelect={(f) => {
                                                    setOrdFile(f);
                                                    setPreviews(prev => ({ ...prev, ord: URL.createObjectURL(f) }));
                                                }}
                                                onClear={() => {
                                                    setOrdFile(null);
                                                    setPreviews(prev => ({ ...prev, ord: undefined }));
                                                }}
                                                tools={(
                                                    <div className="absolute inset-x-0 bottom-0 bg-accent/90 hover:bg-accent transition-all shadow-xl backdrop-blur-sm z-10">
                                                        <button
                                                            type="button"
                                                            disabled={isGenerating.pack || (!aoFile && !roughnessFile && !displacementFile)}
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                setIsGenerating(p => ({ ...p, pack: true }));
                                                                try {
                                                                    const blob = await packORDMap(aoFile || undefined, roughnessFile || undefined, displacementFile || undefined);
                                                                    const file = new File([blob], 'ord.png', { type: 'image/png' });
                                                                    setOrdFile(file);
                                                                    setPreviews(p => ({ ...p, ord: URL.createObjectURL(blob) }));
                                                                    toast.success(t('modal.pack_success'));
                                                                } catch (e) { toast.error(t('modal.pack_error')); } finally {
                                                                    setIsGenerating(p => ({ ...p, pack: false }));
                                                                }
                                                            }}
                                                            className="w-full py-2.5 flex items-center justify-center text-slate-950 font-black uppercase tracking-widest text-[10px] disabled:opacity-50"
                                                            title="You can use sliders to generate maps, split to separate, and then pack"
                                                        >
                                                            {isGenerating.pack ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                                                            PACK ORD
                                                        </button>
                                                    </div>
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                            <TextureSlot
                                                label="Ambient Occlusion"
                                                preview={previews.ao}
                                                file={aoFile}
                                                onFileSelect={(f) => { setAoFile(f); setPreviews(prev => ({ ...prev, ao: URL.createObjectURL(f) })); }}
                                                onClear={() => { setAoFile(null); setPreviews(prev => ({ ...prev, ao: undefined })); }}
                                                tools={
                                                    albedoFile && !previews.ao && (
                                                        <div className="absolute inset-x-0 bottom-0 bg-blue-600/90 hover:bg-blue-500 z-10">
                                                            <button type="button" disabled={isGenerating.ao} onClick={async (e) => {
                                                                e.stopPropagation(); setIsGenerating(p => ({ ...p, ao: true }));
                                                                try {
                                                                    const img = await blobToImage(new Blob([await albedoFile.arrayBuffer()]));
                                                                    const b = await generateAOMap(img, genParams.aoIntensity, genParams.aoBrightness);
                                                                    setAoFile(new File([b], 'ao.png', { type: 'image/png' }));
                                                                    setPreviews(p => ({ ...p, ao: URL.createObjectURL(b) }));
                                                                    toast.success(t('modal.ao_success'));
                                                                } catch (err) { toast.error(t('modal.ao_error')); } finally { setIsGenerating(p => ({ ...p, ao: false })); }
                                                            }} className="w-full py-2.5 text-white font-black text-[10px] flex items-center justify-center">
                                                                {isGenerating.ao ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />} GENERUJ AO
                                                            </button>
                                                        </div>
                                                    )
                                                }
                                            />
                                            <TextureSlot
                                                label="Roughness"
                                                preview={previews.roughness}
                                                file={roughnessFile}
                                                onFileSelect={(f) => { setRoughnessFile(f); setPreviews(prev => ({ ...prev, roughness: URL.createObjectURL(f) })); }}
                                                onClear={() => { setRoughnessFile(null); setPreviews(prev => ({ ...prev, roughness: undefined })); }}
                                                tools={
                                                    albedoFile && !previews.roughness && (
                                                        <div className="absolute inset-x-0 bottom-0 bg-teal-600/90 hover:bg-teal-500 z-10">
                                                            <button type="button" disabled={isGenerating.roughness} onClick={async (e) => {
                                                                e.stopPropagation(); setIsGenerating(p => ({ ...p, roughness: true }));
                                                                try {
                                                                    const img = await blobToImage(new Blob([await albedoFile.arrayBuffer()]));
                                                                    const b = await generateRoughnessMap(img, genParams.roughnessContrast, genParams.roughnessBrightness);
                                                                    setRoughnessFile(new File([b], 'roughness.png', { type: 'image/png' }));
                                                                    setPreviews(p => ({ ...p, roughness: URL.createObjectURL(b) }));
                                                                    toast.success(t('modal.roughness_success'));
                                                                } catch (err) { toast.error(t('modal.roughness_error')); } finally { setIsGenerating(p => ({ ...p, roughness: false })); }
                                                            }} className="w-full py-2.5 text-white font-black text-[10px] flex items-center justify-center">
                                                                {isGenerating.roughness ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />} GENERUJ ROUGH
                                                            </button>
                                                        </div>
                                                    )
                                                }
                                            />
                                            <TextureSlot
                                                label="Displacement"
                                                preview={previews.displacement}
                                                file={displacementFile}
                                                onFileSelect={(f) => { setDisplacementFile(f); setPreviews(prev => ({ ...prev, displacement: URL.createObjectURL(f) })); }}
                                                onClear={() => { setDisplacementFile(null); setPreviews(prev => ({ ...prev, displacement: undefined })); }}
                                                tools={
                                                    normalFile && !previews.displacement && (
                                                        <div className="absolute inset-x-0 bottom-0 bg-orange-600/90 hover:bg-orange-500 z-10">
                                                            <button type="button" disabled={isGenerating.disp} onClick={async (e) => {
                                                                e.stopPropagation(); setIsGenerating(p => ({ ...p, disp: true }));
                                                                try {
                                                                    const img = await blobToImage(new Blob([await normalFile.arrayBuffer()]));
                                                                    const b = await generateDisplacementMap(img, genParams.dispStrength, genParams.dispBlur);
                                                                    setDisplacementFile(new File([b], 'disp.png', { type: 'image/png' }));
                                                                    setPreviews(p => ({ ...p, displacement: URL.createObjectURL(b) }));
                                                                    toast.success(t('modal.disp_success'));
                                                                } catch (err) { toast.error(t('modal.disp_error')); } finally { setIsGenerating(p => ({ ...p, disp: false })); }
                                                            }} className="w-full py-2.5 text-white font-black text-[10px] flex items-center justify-center">
                                                                {isGenerating.disp ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Wand2 className="w-3 h-3 mr-1" />} GENERUJ DISP
                                                            </button>
                                                        </div>
                                                    )
                                                }
                                            />
                                        </div>
                                    )}

                                </div>
                            )}

                            {mainType === 'asset' && isGeneric && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    <div className="p-8 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/30 flex flex-col items-center justify-center text-center gap-4 hover:border-accent/40 hover:bg-accent/5 transition-all group relative cursor-pointer">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) setGenericFile(file);
                                            }}
                                        />
                                        <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                            <Upload className="w-10 h-10 text-accent" />
                                        </div>
                                        <div>
                                            {genericFile ? (
                                                <div className="space-y-1">
                                                    <p className="text-accent font-bold">{genericFile.name}</p>
                                                    <p className="text-slate-500 text-xs">{(genericFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-slate-300 font-bold">Wybierz główny plik assetu</p>
                                                    <p className="text-slate-500 text-xs mt-1">Audio, Blueprint lub HDRi</p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Thumbnail upload if not surface (no sphere preview) */}
                                    <div className="space-y-3">
                                        <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500">Miniaturka (Opcjonalnie)</label>
                                        <div className="flex gap-4 items-center">
                                            <div className="w-24 h-24 rounded-2xl bg-slate-900/50 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                                                {renderedThumbnail ? (
                                                    <img src={renderedThumbnail} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Camera className="w-8 h-8 text-slate-700" />
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold">Zrób zrzut ekranu lub wgraj PNG/JPG aby reprezentować asset w bibliotece.</p>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="block w-full text-[10px] text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-accent/10 file:text-accent hover:file:bg-accent/20 cursor-pointer"
                                                    onChange={async (e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) {
                                                            const reader = new FileReader();
                                                            reader.onload = (ev) => setRenderedThumbnail(ev.target?.result as string);
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* 3D MODEL SECTION - right panel when type is 3d/3dplant */}
                    {mainType === 'asset' && !['surface', 'hdri', 'blueprint', 'sfx', 'music', 'voice'].includes(type) && (
                        <div className="w-full border-l border-slate-800 pl-6 flex flex-col gap-5 overflow-y-auto scrollbar-thin">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Upload className="w-3 h-3 text-accent" />
                                Model 3D + Tekstury
                            </label>

                            {/* FBX/OBJ upload */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">Plik Modelu (FBX / OBJ)</label>
                                <label className={`flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${modelFile ? 'border-accent/40 bg-accent/5' : 'border-slate-700 hover:border-slate-500 bg-slate-900/30'
                                    }`}>
                                    <Upload className={`w-5 h-5 shrink-0 ${modelFile ? 'text-accent' : 'text-slate-600'}`} />
                                    <div className="flex-1 min-w-0">
                                        {modelFile
                                            ? <span className="text-sm text-accent font-bold truncate block">{modelFile.name}</span>
                                            : <span className="text-sm text-slate-500">Przeciągnij lub kliknij – .fbx / .obj / .abc</span>
                                        }
                                    </div>
                                    {modelFile && (
                                        <button type="button" onClick={(e) => { e.preventDefault(); setModelFile(null); }}
                                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-400 transition-all">
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                    <input type="file" className="hidden" accept=".fbx,.obj,.abc"
                                        onChange={(e) => e.target.files?.[0] && setModelFile(e.target.files[0])} />
                                </label>
                            </div>

                            {/* Texture slots */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Tekstury (opcjonalnie – ten sam folder co model)</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <TextureSlot
                                        label="Albedo"
                                        preview={model3dPreviews.albedo}
                                        file={model3dAlbedo}
                                        onFileSelect={(f) => { setModel3dAlbedo(f); setModel3dPreviews(p => ({ ...p, albedo: URL.createObjectURL(f) })); }}
                                        onClear={() => { setModel3dAlbedo(null); setModel3dPreviews(p => ({ ...p, albedo: undefined })); }}
                                    />
                                    <TextureSlot
                                        label="Normal"
                                        preview={model3dPreviews.normal}
                                        file={model3dNormal}
                                        onFileSelect={(f) => { setModel3dNormal(f); setModel3dPreviews(p => ({ ...p, normal: URL.createObjectURL(f) })); }}
                                        onClear={() => { setModel3dNormal(null); setModel3dPreviews(p => ({ ...p, normal: undefined })); }}
                                    />
                                    <TextureSlot
                                        label="Roughness"
                                        preview={model3dPreviews.roughness}
                                        file={model3dRoughness}
                                        onFileSelect={(f) => { setModel3dRoughness(f); setModel3dPreviews(p => ({ ...p, roughness: URL.createObjectURL(f) })); }}
                                        onClear={() => { setModel3dRoughness(null); setModel3dPreviews(p => ({ ...p, roughness: undefined })); }}
                                    />
                                    <TextureSlot
                                        label="AO"
                                        preview={model3dPreviews.ao}
                                        file={model3dAo}
                                        onFileSelect={(f) => { setModel3dAo(f); setModel3dPreviews(p => ({ ...p, ao: URL.createObjectURL(f) })); }}
                                        onClear={() => { setModel3dAo(null); setModel3dPreviews(p => ({ ...p, ao: undefined })); }}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RIGHT PANEL - Preview & Settings */}
                    {mainType === 'asset' && type === 'surface' && previews.albedo && (
                        <div className="w-[320px] shrink-0 flex flex-col gap-4 border-l border-slate-800 pl-6 overflow-y-auto scrollbar-thin">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-accent" />
                                {t('modal.preview')}
                            </label>

                            <div className="h-64 rounded-2xl overflow-hidden glass border border-white/5 relative bg-slate-900/40 shadow-xl">
                                <SpherePreview
                                    albedoUrl={previews.albedo}
                                    normalUrl={previews.normal}
                                    roughnessUrl={previews.ord || previews.roughness} // fallback
                                    normalIntensity={normalIntensity}
                                    interactive={true}
                                    onCanvasReady={(capturer) => { canvasCapturerRef.current = capturer; }}
                                />
                                <div className="absolute bottom-3 left-3 glass px-2 py-1 rounded-lg text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    {t('lib.interactive_render')}
                                </div>
                            </div>

                            <div className="flex flex-col gap-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-accent">Generation Tweaks</span>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Normal Str.</label>
                                        <span className="text-[10px] text-slate-500">{genParams.normalStrength.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={genParams.normalStrength} onChange={e => setGenParams(p => ({ ...p, normalStrength: parseFloat(e.target.value) }))} className="w-full accent-accent h-1" />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-blue-400">AO Intensity</label>
                                        <span className="text-[10px] text-slate-500">{genParams.aoIntensity.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={genParams.aoIntensity} onChange={e => setGenParams(p => ({ ...p, aoIntensity: parseFloat(e.target.value) }))} className="w-full accent-blue-500 h-1" />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Rough Contrast</label>
                                        <span className="text-[10px] text-slate-500">{genParams.roughnessContrast.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={genParams.roughnessContrast} onChange={e => setGenParams(p => ({ ...p, roughnessContrast: parseFloat(e.target.value) }))} className="w-full accent-teal-500 h-1" />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Disp Strength</label>
                                        <span className="text-[10px] text-slate-500">{genParams.dispStrength.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={genParams.dispStrength} onChange={e => setGenParams(p => ({ ...p, dispStrength: parseFloat(e.target.value) }))} className="w-full accent-orange-500 h-1" />
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Spec Contrast</label>
                                        <span className="text-[10px] text-slate-500">{genParams.specContrast.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0.1" max="5.0" step="0.1" value={genParams.specContrast} onChange={e => setGenParams(p => ({ ...p, specContrast: parseFloat(e.target.value) }))} className="w-full accent-yellow-500 h-1" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-3 px-4 rounded-xl text-sm font-medium border border-slate-700 text-slate-400 hover:bg-slate-800 transition-all"
                    >
                        {t('modal.cancel')}
                    </button>
                    {mainType === 'asset' && !['surface', 'hdri', 'blueprint', 'sfx', 'music', 'voice'].includes(type) ? (
                        <button
                            type="button"
                            onClick={handleSubmit3D}
                            disabled={loading || !modelFile || !name || !category}
                            className="flex-[2] py-3 px-4 rounded-xl text-sm font-black uppercase tracking-widest bg-green-600 text-white hover:bg-green-500 transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            ZAPISZ DO BIBLIOTEKI
                        </button>
                    ) : mainType === 'asset' && isGeneric ? (
                        <button
                            type="button"
                            onClick={handleSaveGeneric}
                            disabled={loading || !genericFile || !name || !category}
                            className="flex-[2] py-3 px-4 rounded-xl text-sm font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-500 transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                            ZAPISZ ASSET LOGICZNY
                        </button>
                    ) : (
                        <>
                            {type === 'surface' && previews.albedo && (
                                <button
                                    type="button"
                                    onClick={handleRenderThumbnail}
                                    disabled={isRenderingThumb}
                                    className={`flex items-center gap-1.5 px-4 py-3 rounded-xl text-sm font-bold transition-all border ${renderedThumbnail ? 'bg-green-500/20 border-green-500/30 text-green-400 hover:bg-green-500/30' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                                >
                                    {isRenderingThumb ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                    {renderedThumbnail ? 'THUMBNAIL OK' : ''}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={handleSaveSurface}
                                disabled={loading}
                                className="flex-[2] py-3 px-4 rounded-xl text-sm font-black uppercase tracking-widest bg-accent text-slate-950 hover:bg-accent/90 transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(56,189,248,0.3)] disabled:opacity-50"
                                title="Zapisuje wygenerowane mapy do biblioteki aplikacji."
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                ZAPISZ MATERIAŁ DO BIBLIOTEKI
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div >
    );
}

function TextureSlot({ label, preview, file, onFileSelect, onClear, tools }: {
    label: string,
    preview?: string,
    file: File | null,
    onFileSelect: (f: File) => void,
    onClear: () => void,
    tools?: React.ReactNode
}) {
    const [isDrag, setIsDrag] = useState(false);

    return (
        <div className="space-y-2">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{label}</span>
            <div
                className={`relative aspect-square rounded-2xl border-2 border-dashed overflow-hidden transition-all group ${preview ? 'border-accent/30' : 'border-slate-800 hover:border-slate-600'} ${isDrag ? 'border-accent bg-accent/5 scale-[1.02]' : 'bg-slate-900/30'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDrag(true); }}
                onDragLeave={() => setIsDrag(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsDrag(false);
                    const f = e.dataTransfer.files[0];
                    if (f && f.type.startsWith('image/')) onFileSelect(f);
                }}
            >
                {preview ? (
                    <>
                        <img src={preview} alt={label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={onClear}
                                className="p-2 bg-red-500/20 hover:bg-red-500/80 rounded-xl text-red-500 hover:text-white transition-all shadow-xl backdrop-blur-md"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </>
                ) : (
                    <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer">
                        <Upload className="w-6 h-6 text-slate-700 group-hover:text-slate-500 transition-colors mb-1" />
                        <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">{label}</span>
                        <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
                        />
                    </label>
                )}
                {tools}
            </div>
            {file && (
                <p className="text-[9px] text-slate-500 truncate px-1" title={file.name}>
                    {file.name}
                </p>
            )}
        </div>
    );
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
}
