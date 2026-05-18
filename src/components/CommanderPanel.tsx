'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Folder, File, CornerLeftUp, HardDrive, 
    Copy, Move, Trash2, Plus, X, ArrowRight 
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface FileEntry {
    name: string;
    isDirectory: boolean;
    size: number;
    path: string;
    updatedAt: string;
}

interface PanelState {
    path: string;
    files: FileEntry[];
    selected: string | null; // Path of selected file
    loading: boolean;
}

export default function CommanderPanel({ onClose }: { onClose: () => void }) {
    const { token } = useAuth();
    
    // Initial paths - could be configurable
    const [leftPanel, setLeftPanel] = useState<PanelState>({ path: '', files: [], selected: null, loading: true });
    const [rightPanel, setRightPanel] = useState<PanelState>({ path: '', files: [], selected: null, loading: true });
    const [activePanel, setActivePanel] = useState<'left' | 'right'>('left');

    const fetchFiles = useCallback(async (path: string, panel: 'left' | 'right') => {
        const setPanel = panel === 'left' ? setLeftPanel : setRightPanel;
        setPanel(prev => ({ ...prev, loading: true }));

        try {
            const url = path ? `/api/commander?path=${encodeURIComponent(path)}` : '/api/commander';
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setPanel({
                    path: data.path,
                    files: data.files,
                    selected: null,
                    loading: false
                });
            } else {
                toast.error('Failed to load directory');
                setPanel(prev => ({ ...prev, loading: false }));
            }
        } catch (error) {
            console.error(error);
            setPanel(prev => ({ ...prev, loading: false }));
        }
    }, [token]);

    // Initial load
    useEffect(() => {
        if (token) {
            fetchFiles('', 'left');
            fetchFiles('', 'right');
        }
    }, [token, fetchFiles]);

    const handleNavigate = (path: string, panel: 'left' | 'right') => {
        fetchFiles(path, panel);
    };

    const handleAction = async (action: 'copy' | 'move' | 'delete' | 'mkdir') => {
        const sourcePanel = activePanel === 'left' ? leftPanel : rightPanel;
        const targetPanel = activePanel === 'left' ? rightPanel : leftPanel;

        if (!sourcePanel.selected && action !== 'mkdir') {
            toast.error('No file selected');
            return;
        }

        const sourceFile = sourcePanel.files.find(f => f.path === sourcePanel.selected);
        if (!sourceFile && action !== 'mkdir') return;

        let body: any = { action };

        if (action === 'delete') {
            if (!confirm(`Are you sure you want to delete ${sourceFile?.name}?`)) return;
            body.source = sourceFile?.path;
        } else if (action === 'mkdir') {
            const name = prompt('New directory name:');
            if (!name) return;
            // Use current panel path
            // Assuming we are making dir in CURRENT panel or target? Standard NC makes in current.
            // Let's make in active panel.
            // Wait, standard is F7 MkDir in active panel.
            const basePath = sourcePanel.path; // Or should be target? usually current.
            // Actually let's assume current panel.
            // Path separator handling is tricky in browser, assuming Windows here based on env
            const sep = basePath.includes('\\') ? '\\' : '/';
            body.source = `${basePath}${sep}${name}`;
        } else {
            // Copy/Move
            // Destination is target panel path + filename
            const sep = targetPanel.path.includes('\\') ? '\\' : '/';
            body.source = sourceFile?.path;
            body.destination = `${targetPanel.path}${sep}${sourceFile?.name}`;
        }

        try {
            const res = await fetch('/api/commander', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                toast.success(`Action ${action} successful`);
                // Refresh both panels
                fetchFiles(leftPanel.path, 'left');
                fetchFiles(rightPanel.path, 'right');
            } else {
                toast.error('Action failed');
            }
        } catch (e) {
            toast.error('Network error');
        }
    };

    const FileList = ({ panel, side }: { panel: PanelState, side: 'left' | 'right' }) => {
        const isActive = activePanel === side;
        
        return (
            <div 
                className={`flex-1 flex flex-col border-2 rounded-xl overflow-hidden transition-colors ${isActive ? 'border-accent bg-[#000084]' : 'border-slate-700 bg-slate-900/50'}`}
                onClick={() => setActivePanel(side)}
            >
                {/* Header */}
                <div className={`p-2 px-3 text-sm font-bold font-mono truncate flex items-center gap-2 ${isActive ? 'bg-accent text-slate-950' : 'bg-slate-800 text-slate-400'}`}>
                    <HardDrive className="w-4 h-4" />
                    {panel.path || 'Loading...'}
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto font-mono text-sm p-1">
                    {/* Parent Dir */}
                    <div 
                        className="flex items-center gap-2 px-2 py-1 text-white hover:bg-white/20 cursor-pointer select-none"
                        onClick={(e) => {
                            e.stopPropagation();
                            // Go up
                            const parent = panel.path.split(/[/\\]/).slice(0, -1).join('\\') || '/'; // Simple logic
                            handleNavigate(parent, side);
                        }}
                    >
                        <CornerLeftUp className="w-4 h-4 text-accent" />
                        <span>..</span>
                    </div>

                    {panel.files.map((file) => (
                        <div 
                            key={file.path}
                            className={`flex items-center gap-2 px-2 py-0.5 cursor-pointer select-none ${panel.selected === file.path ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-white hover:bg-white/10'}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                const setPanel = side === 'left' ? setLeftPanel : setRightPanel;
                                setPanel(prev => ({ ...prev, selected: file.path }));
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                if (file.isDirectory) {
                                    handleNavigate(file.path, side);
                                }
                            }}
                        >
                            {file.isDirectory ? <Folder className="w-4 h-4 text-amber-400" /> : <File className="w-4 h-4 text-blue-300" />}
                            <span className="truncate flex-1">{file.name}</span>
                            <span className="text-[10px] opacity-70 w-20 text-right">
                                {file.isDirectory ? '<DIR>' : (file.size / 1024).toFixed(0) + ' KB'}
                            </span>
                        </div>
                    ))}
                </div>
                
                {/* Status Bar */}
                <div className="bg-black/40 p-1 px-2 text-[10px] font-mono text-slate-400 flex justify-between">
                    <span>{panel.files.length} items</span>
                    <span>{panel.selected ? 'Selected' : 'Ready'}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-[250] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-7xl h-[90vh] flex flex-col bg-[#020617] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                
                {/* Top Bar */}
                <div className="h-12 border-b border-white/10 flex items-center justify-between px-4 bg-slate-900/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-lg">
                            NC
                        </div>
                        <h2 className="font-bold text-white tracking-widest uppercase text-sm">Norton Clone v1.0</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Panels Area */}
                <div className="flex-1 flex gap-2 p-2 min-h-0">
                    <FileList panel={leftPanel} side="left" />
                    <FileList panel={rightPanel} side="right" />
                </div>

                {/* Function Keys Bar */}
                <div className="h-14 bg-slate-950 border-t border-white/10 flex items-center px-2 gap-2 text-xs font-mono font-bold">
                    <button className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300">
                        <span className="text-white">F3</span> View
                    </button>
                    <button className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300">
                        <span className="text-white">F4</span> Edit
                    </button>
                    <button 
                        onClick={() => handleAction('copy')}
                        className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300 active:bg-accent active:text-black"
                    >
                        <span className="text-white">F5</span> Copy
                    </button>
                    <button 
                        onClick={() => handleAction('move')}
                        className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300 active:bg-accent active:text-black"
                    >
                        <span className="text-white">F6</span> Move
                    </button>
                    <button 
                        onClick={() => handleAction('mkdir')}
                        className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300 active:bg-accent active:text-black"
                    >
                        <span className="text-white">F7</span> MkDir
                    </button>
                    <button 
                        onClick={() => handleAction('delete')}
                        className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300 active:bg-red-500 active:text-white"
                    >
                        <span className="text-white">F8</span> Delete
                    </button>
                    <button 
                        onClick={onClose}
                        className="flex-1 bg-slate-800 h-10 rounded flex items-center justify-center gap-2 hover:bg-slate-700 text-slate-300 active:bg-accent active:text-black"
                    >
                        <span className="text-white">F10</span> Quit
                    </button>
                </div>
            </div>
        </div>
    );
}
