'use client';

import { useState, useMemo, useEffect } from 'react';
import { Asset } from '@/lib/assets';
import ExportButton from './ExportButton';
import NewAssetModal from './NewAssetModal';
import ChatPanel from './ChatPanel';
import ActivationModal from './ActivationModal';
import { useRouter } from 'next/navigation';
import {
    Plus, Search, ChevronDown, ChevronRight, Library, Users, Folder,
    Box, Square, Zap, Leaf, Grid, LayoutGrid, Columns, Settings, FolderOpen,
    X, Loader2, Maximize2, Car, User, Image as ImageIcon,
    Monitor, Wifi, WifiOff, Clock, Activity, Filter, Download, LogOut, Check, Globe, LayoutList, GripVertical
} from 'lucide-react';
// import SpherePreview from './SpherePreview';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';
import LanguageSwitch from './LanguageSwitch';
import { useNetwork } from '@/context/NetworkContext';

interface AssetLibraryProps {
    initialAssets: Asset[];
}

export default function AssetLibrary({ initialAssets }: AssetLibraryProps) {
    const router = useRouter();
    const { token, user } = useAuth();
    const { t } = useLanguage();
    const { isOnline, isOfflineMode, toggleOfflineMode } = useNetwork();
    const [search, setSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [isNewAssetModalOpen, setIsNewAssetModalOpen] = useState(false);
    const [blenderConnected, setBlenderConnected] = useState(false);

    // Shared Library States
    const [selectedLibraryId, setSelectedLibraryId] = useState<string | null>(null);
    const [sharedLibraries, setSharedLibraries] = useState<any[]>([]);
    const [collapsedSections, setCollapsedSections] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [gridCols, setGridCols] = useState<number>(6);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [libraryPath, setLibraryPath] = useState(process.env.NEXT_PUBLIC_LIBRARY_PATH || '');
    const [isSavingPath, setIsSavingPath] = useState(false);
    const [selectedAddType, setSelectedAddType] = useState<string>('surface');
    const [fps, setFps] = useState(60);
    const [ping, setPing] = useState(12);
    const [currentTime, setCurrentTime] = useState(new Date());

    const MAIN_GROUPS = [
        { id: '3D MODELS', types: ['3d'], icon: Box, addType: '3d' },
        { id: '3D PLANTS', types: ['3dplant'], icon: Leaf, addType: '3dplant' },
        { id: 'MATERIALS', types: ['surface'], icon: Square, addType: 'surface' },
        { id: 'VEHICLES', types: ['vehicle'], icon: Car, addType: 'vehicle' },
        { id: 'CHARACTERS', types: ['character'], icon: User, addType: 'character' },
        { id: 'SCENES', types: ['scene'], icon: ImageIcon, addType: 'scene' },
        { id: 'ADDONS', types: ['addon'], icon: Zap, addType: 'addon' },
    ];

    const openAddModal = (type: string) => {
        setSelectedAddType(type);
        setIsNewAssetModalOpen(true);
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

    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
            setFps(prev => Math.max(58, Math.min(62, prev + (Math.random() - 0.5))));
            setPing(prev => Math.max(10, Math.min(25, prev + (Math.random() * 4 - 2))));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const checkConnection = async () => {
            try {
                const res = await fetch('/api/blender/status');
                const data = await res.json();
                setBlenderConnected(data.connected);
            } catch (e) {
                setBlenderConnected(false);
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

    const updateLibraryPath = async () => {
        if (!libraryPath.trim()) return;
        setIsSavingPath(true);
        try {
            const res = await fetch('/api/settings/library-path', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ libraryPath })
            });

            if (res.ok) {
                toast.success('Library path updated! Restarting server...');
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
        if (!selectedLibraryId) return initialAssets;
        const lib = sharedLibraries.find(l => l.userId === selectedLibraryId);
        return lib ? (lib.assets as Asset[]) : [];
    }, [selectedLibraryId, initialAssets, sharedLibraries]);

    const filteredAssets = useMemo(() => {
        return activeAssets.filter(asset => {
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
    }, [activeAssets, search, selectedGroup, selectedCategory]);

    const categories = useMemo(() => {
        const catSet = new Set<string>();
        const baseAssets = selectedGroup === 'all'
            ? activeAssets
            : activeAssets.filter(a => MAIN_GROUPS.find(g => g.id === selectedGroup)?.types.includes(a.type));

        baseAssets.forEach(a => {
            a.categories?.forEach(c => {
                if (c) catSet.add(c.toLowerCase().trim());
            });
        });

        const sortedCats = Array.from(catSet).sort((a, b) => {
            const nameA = t(`cat.${a}`).toLowerCase();
            const nameB = t(`cat.${b}`).toLowerCase();
            return nameA.localeCompare(nameB);
        });

        return ['all', ...sortedCats];
    }, [activeAssets, selectedGroup, t]);

    return (
        <div className="relative min-h-screen">
            {/* Professional App Top Bar */}
            <div className="fixed top-0 left-0 right-0 h-9 z-[60] bg-slate-950/80 backdrop-blur-2xl border-b border-white/10 px-4 flex items-center justify-between select-none">
                <div className="flex items-center gap-5">
                    <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_10px_rgba(56,189,248,0.6)]" />
                        <span className="text-[11px] font-black tracking-tight text-white">Bridge Hub</span>
                    </div>

                    <div className="h-4 w-[1px] bg-white/10 mx-1" />

                    <div className="flex items-center">
                        {['file', 'edit', 'view', 'connect', 'help'].map((item) => (
                            <button
                                key={item}
                                className="px-3 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded transition-all"
                            >
                                {t(`menu.${item}`)}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
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
                    <div className="hidden lg:flex items-center gap-5 px-4 py-1 rounded-full bg-black/40 border border-white/5">
                        {/* Connection Status Indicators */}
                        <div className="flex items-center gap-2 pr-2">
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/5">
                                <div className={`w-1.5 h-1.5 rounded-full ${blenderConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]' : 'bg-slate-600'}`} />
                                <span className="text-[9px] font-semibold text-slate-400">Blender</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/30 rounded-lg border border-white/5">
                                <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-cyan-500 shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'bg-slate-600'}`} />
                                <span className="text-[9px] font-semibold text-slate-400">Network</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 px-2 py-1 rounded bg-white/5 border border-white/5">
                                <span className="text-[9px] font-bold text-slate-500">{user?.username || 'Guest'}</span>
                            </div>
                            <button
                                onClick={() => setIsSettingsOpen(true)}
                                className="p-1.5 hover:bg-white/5 rounded transition-colors group"
                                title="Application Settings"
                            >
                                <Settings className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent group-hover:rotate-45 transition-all duration-300" />
                            </button>
                        </div>

                        {/* License Status & Activate Button */}
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400">
                                <Check className="w-3 h-3" />
                                <span className="text-[10px] font-black uppercase tracking-tighter">Premium</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div className="pt-10 pl-1 pr-4 relative">
                {/* Refined Vertical Toolbar */}
                <div className="fixed left-0 top-24 z-40 hidden lg:flex flex-col gap-0">
                    {MAIN_GROUPS.map((group) => {
                        const GroupIcon = group.icon;
                        return (
                            <button
                                key={group.id}
                                onClick={() => openAddModal(group.addType)}
                                className="glass group relative flex flex-col items-center justify-center h-32 w-10 hover:bg-slate-900 transition-all duration-200 rounded-none border-b border-r border-white/10 first:border-t border-t-0 border-l-0 bg-slate-950/90 hover:w-11 shadow-none backdrop-blur-md gap-2"
                                title={`Add ${group.id}`}
                            >
                                <div className="w-5 h-5 rounded flex items-center justify-center bg-accent/10 group-hover:bg-accent/20 transition-colors shrink-0">
                                    <GroupIcon className="w-3.5 h-3.5 text-accent" />
                                </div>

                                <div className="flex-1 flex items-center justify-center min-h-0">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-white [writing-mode:vertical-rl] whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity">
                                        {t('lib.add_prefix')} {t(`type.${group.id.toLowerCase().replace(' ', '_').replace('3d_models', '3d').replace('3d_plants', '3dplant').replace('materials', 'surface').replace('vehicles', 'vehicle').replace('characters', 'character').replace('scenes', 'scene').replace('addons', 'addon')}`)}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="space-y-8 pl-9">
                    <header className="mb-10 -mt-6 flex flex-col lg:flex-row items-center justify-between gap-8">
                        <div className="flex flex-col lg:flex-row items-center gap-8">
                            <div className="relative overflow-hidden rounded-2xl glass group h-24 flex items-center bg-slate-900/40 shrink-0 border border-white/5">
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

                            <div className="flex wrap gap-5 items-center justify-center lg:justify-start">
                                {[
                                    { name: 'Blender', connected: blenderConnected },
                                    { name: 'Unreal', connected: false },
                                    { name: 'Unity', connected: false },
                                    { name: '3ds Max', connected: false },
                                    { name: 'C4D', connected: false }
                                ].map((plugin) => (
                                    <div key={plugin.name} className="flex flex-col items-center gap-1.5">
                                        <div className={`glass px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-2 border border-white/5 ${plugin.connected ? 'text-green-400 border-green-500/20' : 'text-slate-500 border-white/5'}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${plugin.connected ? 'bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'bg-slate-700'}`} />
                                            {plugin.name.toUpperCase()}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <button className="flex items-center gap-1 text-[9px] text-slate-500 hover:text-accent transition-colors group/btn">
                                                <ChevronDown className="w-2.5 h-2.5 group-hover/btn:translate-y-0.5 transition-transform" />
                                                <span className="font-medium opacity-80 uppercase tracking-tighter">{t('plugin.download')}</span>
                                            </button>
                                            {plugin.name === 'Blender' && (
                                                <button className="flex items-center gap-1 text-[9px] text-accent/70 hover:text-accent transition-colors group/btn">
                                                    <ChevronDown className="w-2.5 h-2.5 group-hover/btn:translate-y-0.5 transition-transform" />
                                                    <span className="font-bold opacity-90 uppercase tracking-tighter">{t('plugin.download_36')}</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Buy Me a Coffee Button */}
                        <a
                            href="https://www.buymeacoffee.com/morbidnoizl"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="glass flex items-center gap-3 px-6 py-3 bg-[#5F7FFF]/10 hover:bg-[#5F7FFF]/20 border border-[#5F7FFF]/30 rounded-2xl transition-all shadow-xl hover:shadow-[#5F7FFF]/10 group shrink-0"
                        >
                            <div className="w-10 h-10 bg-[#5F7FFF] rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                                <Plus className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex flex-col items-start leading-none">
                                <span className="text-[10px] font-bold text-[#5F7FFF] uppercase tracking-widest mb-1.5">{t('coffee.support')}</span>
                                <span className="text-base font-black text-white">{t('coffee.button')}</span>
                            </div>
                        </a>
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
                            {/* Grid Controls */}
                            <div className="flex items-center bg-slate-900/50 p-1 rounded-xl border border-slate-700/50">
                                {[4, 5, 6].map((cols) => (
                                    <button
                                        key={cols}
                                        onClick={() => setGridCols(cols)}
                                        className={`p-1.5 rounded-lg transition-all ${gridCols === cols ? 'bg-accent text-slate-950 px-3' : 'text-slate-500 hover:text-slate-300'}`}
                                        title={t('grid.cols_tooltip').replace('{cols}', cols.toString())}
                                    >
                                        <div className="flex items-center gap-1.5 ">
                                            {cols === 4 ? <LayoutGrid className="w-3.5 h-3.5" /> : cols === 5 ? <Grid className="w-3.5 h-3.5" /> : <Columns className="w-3.5 h-3.5 rotate-90" />}
                                            <span className="text-[10px] font-bold">{cols}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>

                        </div>
                    </div>

                    {/* Main Library Layout */}
                    <div className="flex flex-col lg:flex-row gap-8 items-start">
                        {/* Categories Sidebar */}
                        <aside className="w-full lg:w-72 shrink-0 lg:sticky lg:top-8 space-y-4">
                            {/* Library Sections */}
                            {[
                                { id: 'my', name: t('lib.my_library'), active: selectedLibraryId === null },
                                ...sharedLibraries.map(lib => ({ id: lib.userId, name: `${lib.username}${t('lib.user_library')}`, active: selectedLibraryId === lib.userId }))
                            ].map(section => (
                                <div key={section.id} className="matte-card rounded-2xl overflow-hidden border border-white/5">
                                    <div
                                        onClick={() => {
                                            if (section.id === 'my') setSelectedLibraryId(null);
                                            else setSelectedLibraryId(section.id);
                                            toggleSection(section.id);
                                        }}
                                        className={`w-full flex items-center justify-between p-4 bg-slate-900/40 hover:bg-slate-800/40 transition-colors cursor-pointer ${section.active ? 'border-l-2 border-accent' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-3">
                                                {section.id === 'my' ? <Library className={`w-4 h-4 ${section.active ? 'text-accent' : 'text-slate-500'}`} /> : <Users className={`w-4 h-4 ${section.active ? 'text-accent' : 'text-slate-500'}`} />}
                                                <span className={`text-[11px] font-bold tracking-wide ${section.active ? 'text-white' : 'text-slate-500'}`}>{section.name}</span>
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
                                                const isActiveGroup = section.active && selectedGroup === group.id;
                                                const GroupIcon = group.icon;
                                                return (
                                                    <div key={group.id} className="space-y-0.5">
                                                        <button
                                                            onClick={() => {
                                                                if (section.id === 'my') setSelectedLibraryId(null);
                                                                else setSelectedLibraryId(section.id);
                                                                setSelectedGroup(isActiveGroup ? 'all' : group.id);
                                                                setSelectedCategory('all');
                                                            }}
                                                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${isActiveGroup
                                                                ? 'bg-accent/20 text-accent border border-accent/20'
                                                                : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <GroupIcon className="w-3 h-3" />
                                                                <span>{t(`group.${group.id.toLowerCase().replace(/ /g, '_')}`)}</span>
                                                            </div>
                                                            {section.active && selectedGroup === group.id ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
                                                        </button>

                                                        {isActiveGroup && (
                                                            <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-white/5 ml-4">
                                                                {categories.map(cat => (
                                                                    <button
                                                                        key={cat}
                                                                        onClick={() => setSelectedCategory(cat)}
                                                                        className={`w-full text-left px-2 py-1.5 rounded-md text-[10px] transition-all flex items-center justify-between ${selectedCategory === cat
                                                                            ? 'text-accent font-bold'
                                                                            : 'text-slate-500 hover:text-slate-300'}`}
                                                                    >
                                                                        <span>{cat === 'all' ? t('cat.all') : t(`cat.${cat.toLowerCase()}`) !== `cat.${cat.toLowerCase()}` ? t(`cat.${cat.toLowerCase()}`) : cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                                                                        {selectedCategory === cat && <div className="w-1 h-1 rounded-full bg-accent" />}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )
                                                        }
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </aside >

                        {/* Asset Grid */}
                        <div className="flex-1 min-w-0">
                            <div className={
                                `grid gap-4 transition-all duration-500 ` +
                                (gridCols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' :
                                    gridCols === 5 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' :
                                        'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6')
                            }>
                                {filteredAssets.map((asset) => (
                                    <div
                                        key={asset.id}
                                        className="matte-card rounded-2xl overflow-hidden group flex flex-col h-full border border-white/5 hover:border-accent/20 transition-all duration-300"
                                    >
                                        <div className="aspect-square bg-slate-900/50 relative overflow-hidden shrink-0">
                                            {asset.thumbnail ? (
                                                <>
                                                    <img
                                                        src={`/api/assets/thumbnail?path=${encodeURIComponent(asset.thumbnail)}`}
                                                        alt={asset.name}
                                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                                                    />
                                                </>
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

                                            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                                <div className="glass px-2 py-1 rounded-lg text-[10px] font-mono text-slate-300 border border-white/10">
                                                    {asset.id}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 flex-1 flex flex-col justify-between min-h-0">
                                            <div className="min-h-0">
                                                <div className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider flex items-center gap-2 group-hover:text-accent/60 transition-colors">
                                                    <span className="w-1 h-1 rounded-full bg-slate-700 group-hover:bg-accent transition-colors" />
                                                    {t(`type.${asset.type}`)}
                                                </div>
                                                <h3 className="font-semibold text-slate-100 truncate mb-4 leading-tight group-hover:text-accent transition-colors" title={asset.name}>
                                                    {asset.name}
                                                </h3>
                                            </div>
                                            <ExportButton asset={asset} disabled={!blenderConnected} />
                                        </div>
                                    </div>
                                ))}

                                {filteredAssets.length === 0 && (
                                    <div className="col-span-full py-32 text-center glass rounded-3xl border border-white/5">
                                        <div className="w-16 h-16 bg-slate-900/50 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                                            <Search className="w-6 h-6 text-slate-600" />
                                        </div>
                                        <h4 className="text-slate-200 text-xl font-semibold mb-2">{t('lib.no_matching')}</h4>
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

                        {/* Chat Panel */}
                        <ChatPanel />
                    </div>

                    <NewAssetModal
                        isOpen={isNewAssetModalOpen}
                        onClose={() => setIsNewAssetModalOpen(false)}
                        onSuccess={() => router.refresh()}
                        initialType={selectedAddType}
                    />

                    {/* Settings Modal */}
                    {isSettingsOpen && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)} />
                            <div className="glass w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 animate-in fade-in zoom-in-95 duration-200 shadow-2xl">
                                {/* Modal Header */}
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-accent/10 rounded-xl text-accent">
                                            <Settings className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h2 className="text-lg font-bold text-white">{t('settings.title')}</h2>
                                            <p className="text-xs text-slate-500">{t('settings.subtitle')}</p>
                                        </div>
                                    </div>
                                    <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                                        <X className="w-5 h-5 text-slate-500" />
                                    </button>
                                </div>

                                {/* Modal Content */}
                                <div className="p-6 space-y-6">
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('lib.path')}</label>
                                            <span className="text-[10px] text-slate-500 font-mono">{t('settings.current')}: {process.env.NEXT_PUBLIC_LIBRARY_PATH || t('settings.not_set')}</span>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={libraryPath}
                                                onChange={(e) => setLibraryPath(e.target.value)}
                                                placeholder={t('settings.path_placeholder')}
                                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-accent/50 transition-all pl-12"
                                            />
                                            <FolderOpen className="w-5 h-5 absolute left-4 top-3 text-slate-500" />
                                        </div>
                                        <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                            {t('settings.path_hint').split('assetsData.json').map((part, i, arr) => (
                                                <span key={i}>
                                                    {part}
                                                    {i < arr.length - 1 && <code className="text-accent/60">assetsData.json</code>}
                                                </span>
                                            ))}
                                        </p>
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
                                        onClick={updateLibraryPath}
                                        disabled={isSavingPath || !libraryPath.trim()}
                                        className="flex-2 px-8 py-3 bg-accent text-slate-950 rounded-2xl text-sm font-bold hover:shadow-[0_0_20px_rgba(56,189,248,0.4)] disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
                                    >
                                        {isSavingPath ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                        {t('settings.save')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <ActivationModal />
        </div>
    );
}
