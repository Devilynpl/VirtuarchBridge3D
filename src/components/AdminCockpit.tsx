'use client';

import React, { useEffect, useState } from 'react';
import {
    Users, Box, MessageSquare, HardDrive, Activity,
    TrendingUp, ShieldCheck, AlertCircle, RefreshCw, X,
    Database, Server, Globe, Brush
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import ButtonCreator from './ButtonCreator';

interface AdminStats {
    users: number;
    assets: number;
    channels: number;
    messages: number;
    storage: {
        bytes: number;
        gb: string;
        count: number;
    };
    requests: {
        pending: number;
        fulfilled: number;
        total: number;
    };
}

interface AdminCockpitProps {
    onClose: () => void;
}

export default function AdminCockpit({ onClose }: AdminCockpitProps) {
    const { token } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [isButtonCreatorOpen, setIsButtonCreatorOpen] = useState(false);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/stats', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            } else {
                toast.error('Failed to load admin stats');
            }
        } catch (e) {
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) fetchStats();
    }, [token]);

    const StatCard = ({ title, value, sub, icon: Icon, color }: any) => (
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden group hover:border-white/10 transition-all">
            <div className={`absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity ${color}`}>
                <Icon className="w-16 h-16" />
            </div>
            <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
                <h3 className="text-3xl font-black text-white">{value}</h3>
            </div>
            {sub && <p className="text-[10px] text-slate-500 font-mono mt-2">{sub}</p>}
        </div>
    );

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-6xl h-[85vh] bg-[#020617] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center border border-indigo-500/20">
                            <Activity className="w-6 h-6 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white uppercase tracking-widest">Admin Cockpit</h2>
                            <p className="text-xs text-slate-400 font-mono">SYSTEM_OVERVIEW // V1.0</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsButtonCreatorOpen(true)}
                            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl font-bold text-xs uppercase tracking-widest transition-colors flex items-center gap-2 border border-indigo-500/20"
                        >
                            <Brush className="w-4 h-4" />
                            Button Creator
                        </button>
                        <button 
                            onClick={fetchStats} 
                            disabled={loading}
                            className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white transition-colors"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-red-500/10 rounded-xl text-slate-400 hover:text-red-400 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading && !stats ? (
                        <div className="flex items-center justify-center h-full">
                            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                        </div>
                    ) : stats ? (
                        <div className="space-y-8">
                            
                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard 
                                    title="Total Users" 
                                    value={stats.users} 
                                    sub="Active Accounts"
                                    icon={Users} 
                                    color="text-blue-500" 
                                />
                                <StatCard 
                                    title="Assets Library" 
                                    value={stats.assets} 
                                    sub="Indexed Items"
                                    icon={Box} 
                                    color="text-emerald-500" 
                                />
                                <StatCard 
                                    title="Channels" 
                                    value={stats.channels} 
                                    sub="Active Rooms"
                                    icon={MessageSquare} 
                                    color="text-violet-500" 
                                />
                                <StatCard 
                                    title="Data Traffic" 
                                    value={`${stats.storage.gb} GB`} 
                                    sub={`${stats.storage.count} Files Transferred`}
                                    icon={HardDrive} 
                                    color="text-rose-500" 
                                />
                            </div>

                            {/* Detailed Sections */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                {/* Network Health */}
                                <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-6 col-span-2">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Server className="w-5 h-5 text-indigo-400" />
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Network Activity</h3>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Messages Sent</p>
                                            <p className="text-2xl font-mono text-white">{stats.messages}</p>
                                        </div>
                                        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Avg. File Size</p>
                                            <p className="text-2xl font-mono text-white">
                                                {stats.storage.count > 0 
                                                    ? (stats.storage.bytes / stats.storage.count / 1024 / 1024).toFixed(1) 
                                                    : '0'} MB
                                            </p>
                                        </div>
                                        <div className="bg-black/40 rounded-xl p-4 border border-white/5">
                                            <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">P2P Relay</p>
                                            <p className="text-2xl font-mono text-emerald-400">ACTIVE</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Requests Status */}
                                <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-6">
                                    <div className="flex items-center gap-2 mb-6">
                                        <Database className="w-5 h-5 text-amber-400" />
                                        <h3 className="text-sm font-bold text-white uppercase tracking-widest">Asset Requests</h3>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                                            <span className="text-xs text-slate-400 font-bold">Pending</span>
                                            <span className="text-amber-400 font-mono font-bold">{stats.requests.pending}</span>
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-white/5">
                                            <span className="text-xs text-slate-400 font-bold">Fulfilled</span>
                                            <span className="text-emerald-400 font-mono font-bold">{stats.requests.fulfilled}</span>
                                        </div>
                                        <div className="h-px bg-white/10 my-2" />
                                        <div className="flex items-center justify-between px-1">
                                            <span className="text-[10px] text-slate-500 uppercase tracking-widest">Completion Rate</span>
                                            <span className="text-xs text-white font-mono">
                                                {stats.requests.total > 0 
                                                    ? Math.round((stats.requests.fulfilled / stats.requests.total) * 100) 
                                                    : 0}%
                                            </span>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* System Log / Footer */}
                            <div className="flex items-center justify-between pt-6 border-t border-white/5">
                                <p className="text-[10px] text-slate-600 font-mono">
                                    SERVER_ID: {token ? 'CONNECTED' : 'OFFLINE'} // REGION: EU-CENTRAL
                                </p>
                                <div className="flex gap-2">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">System Operational</p>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="text-center text-red-500">Failed to load data</div>
                    )}
                </div>
            </div>
            {isButtonCreatorOpen && <ButtonCreator onClose={() => setIsButtonCreatorOpen(false)} />}
        </div>
    );
}
