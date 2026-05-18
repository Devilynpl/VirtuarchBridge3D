'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, X, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface LogEntry {
    type: 'log' | 'warn' | 'error';
    message: string;
    time: string;
}

export default function ConsolePage() {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        document.title = "System Console";
        // 1. Initial Load from LocalStorage
        const storedLogs = localStorage.getItem('app_logs');
        if (storedLogs) {
            try {
                setLogs(JSON.parse(storedLogs));
            } catch (e) {
                console.error('Failed to parse stored logs', e);
            }
        }

        // 2. Listen for real-time updates via BroadcastChannel
        const channel = new BroadcastChannel('app-logs');
        channel.onmessage = (event) => {
            const newLog = event.data as LogEntry;
            setLogs(prev => [...prev.slice(-199), newLog]);
        };

        return () => channel.close();
    }, []);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs]);

    const clearLogs = () => {
        setLogs([]);
        localStorage.removeItem('app_logs');
    };

    return (
        <div className="h-screen w-screen bg-[#0c0d0e] flex flex-col font-mono selection:bg-accent/30 overflow-hidden">
            {/* Header */}
            <div className="h-12 shrink-0 border-b border-white/5 bg-black/40 px-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                    <Terminal className="w-4 h-4 text-[#38bdf8]" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">System Console</span>
                    <div className="h-4 w-[1px] bg-white/10 mx-2" />
                    <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-slate-500" /> {logs.filter(l => l.type === 'log').length} Logs</span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> {logs.filter(l => l.type === 'warn').length} Warnings</span>
                        <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> {logs.filter(l => l.type === 'error').length} Errors</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={clearLogs}
                        className="p-2 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-all flex items-center gap-2 group"
                    >
                        <Trash2 className="w-3.5 h-3.5 group-hover:text-red-400" />
                        <span className="text-[10px] font-bold">CLEAR</span>
                    </button>
                </div>
            </div>

            {/* Logs Area */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-6 space-y-2 scroll-smooth"
            >
                {logs.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 animate-in fade-in duration-700">
                        <Terminal className="w-12 h-12 mb-4 opacity-10" />
                        <p className="text-[11px] uppercase tracking-widest font-bold">Awaiting system events...</p>
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={`flex gap-4 py-1 animate-in slide-in-from-left-2 duration-200 ${log.type === 'error' ? 'text-red-400' :
                            log.type === 'warn' ? 'text-amber-400' :
                                'text-slate-300'
                            }`}>
                            <div className="flex-none w-20 text-slate-600 text-[10px] mt-0.5">[{log.time}]</div>
                            <div className="flex-none mt-0.5">
                                {log.type === 'error' ? <AlertCircle className="w-3.5 h-3.5" /> :
                                    log.type === 'warn' ? <AlertTriangle className="w-3.5 h-3.5" /> :
                                        <Info className="w-3.5 h-3.5 opacity-40" />}
                            </div>
                            <div className="flex-1 break-all whitespace-pre-wrap leading-relaxed text-[12px]">
                                {log.message}
                            </div>
                        </div>
                    ))
                )}
                <div className="h-8 shrink-0" />
            </div>

            {/* Footer Info */}
            <div className="h-8 shrink-0 bg-black/60 border-t border-white/5 px-4 flex items-center justify-between text-[10px] text-slate-600 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-4">
                    <span>Bridge App Renderer Process</span>
                    <span>Buffer: 200 Lines</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Live Sync Active
                </div>
            </div>
        </div>
    );
}
