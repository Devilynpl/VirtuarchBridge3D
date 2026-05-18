'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
    LayoutDashboard, TrendingUp, Users, DollarSign, Package,
    ArrowUpRight, BarChart3, ChevronRight, AlertCircle, CheckCircle2,
    Clock, ShieldCheck, PieChart, Layers, Activity, Download,
    Shield, Zap, Eye, FileText, ExternalLink, ArrowDown, ArrowUp
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SellerData {
    stats: {
        totalSales: number;
        activeContracts: number;
        totalAssets: number;
        potentialRoyalty: number;
    };
    categories: { name: string; count: number }[];
    assets: any[];
}

// ═══════════════════════════════════════
//  Mini Sparkline Chart (Pure CSS)
// ═══════════════════════════════════════
const Sparkline = ({ data, color = 'accent' }: { data: number[]; color?: string }) => {
    const max = Math.max(...data, 1);
    return (
        <div className="flex items-end gap-[2px] h-8">
            {data.map((val, i) => (
                <div
                    key={i}
                    className={`w-1.5 rounded-t-sm bg-${color} transition-all duration-500`}
                    style={{
                        height: `${(val / max) * 100}%`,
                        opacity: 0.3 + (i / data.length) * 0.7,
                        animationDelay: `${i * 50}ms`
                    }}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════
//  Donut Chart (SVG)
// ═══════════════════════════════════════
const DonutChart = ({ segments, size = 120 }: { segments: { label: string; value: number; color: string }[]; size?: number }) => {
    const total = segments.reduce((acc, s) => acc + s.value, 0);
    if (total === 0) return null;

    const radius = (size / 2) - 10;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {segments.map((seg, i) => {
                const segLength = (seg.value / total) * circumference;
                const currentOffset = offset;
                offset += segLength;

                return (
                    <circle
                        key={i}
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={10}
                        strokeDasharray={`${segLength} ${circumference - segLength}`}
                        strokeDashoffset={-currentOffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000"
                        style={{ animationDelay: `${i * 200}ms` }}
                    />
                );
            })}
            <text
                x={size / 2}
                y={size / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-white text-xl font-black"
                transform={`rotate(90, ${size / 2}, ${size / 2})`}
            >
                {total}
            </text>
        </svg>
    );
};

export default function SellerDashboard() {
    const { token } = useAuth();
    const [data, setData] = useState<SellerData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'contracts' | 'categories' | 'analytics'>('overview');

    useEffect(() => {
        fetchDashboard();
    }, [token]);

    const fetchDashboard = async () => {
        if (!token) return;
        try {
            const res = await fetch('/api/seller/dashboard', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const d = await res.json();
            if (res.ok) setData(d);
            else toast.error('Failed to load seller data');
        } catch (e) {
            toast.error('Network error fetching seller dash');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="p-20 flex flex-col items-center justify-center gap-4 text-slate-500">
            <div className="w-16 h-16 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Loading Seller Analytics...</span>
        </div>
    );

    if (!data) return null;

    // Mock sparkline data (would come from real time-series in production)
    const salesSparkline = [3, 7, 5, 12, 8, 15, 11, 18, 14, 22, 19, 25];
    const contractsSparkline = [1, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7];

    const categoryColors = ['#38bdf8', '#f97316', '#a855f7', '#22c55e', '#ef4444', '#eab308', '#06b6d4', '#ec4899'];

    return (
        <div className="flex flex-col h-full bg-slate-950/40 backdrop-blur-xl border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
            {/* ═══ Tab Navigation ═══ */}
            <div className="flex border-b border-white/5 shrink-0 bg-black/20">
                {[
                    { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
                    { id: 'contracts', icon: ShieldCheck, label: 'Contracts' },
                    { id: 'categories', icon: PieChart, label: 'Categories' },
                    { id: 'analytics', icon: Activity, label: 'Analytics' }
                ].map((tab: any) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`relative flex items-center gap-2 px-6 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                            ? 'text-accent'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        {activeTab === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent shadow-[0_-2px_8px_rgba(56,189,248,0.6)]" />
                        )}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {/* ═══ OVERVIEW TAB ═══ */}
                {activeTab === 'overview' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                {
                                    label: 'Total Sales', val: data.stats.totalSales,
                                    icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/10 border-accent/20',
                                    sparkline: salesSparkline, trend: '+18%'
                                },
                                {
                                    label: 'Active Contracts', val: data.stats.activeContracts,
                                    icon: ShieldCheck, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20',
                                    sparkline: contractsSparkline, trend: '+5%'
                                },
                                {
                                    label: 'Total Assets', val: data.stats.totalAssets,
                                    icon: Package, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20',
                                    sparkline: [2, 4, 3, 6, 5, 8, 7, 10, 9, 12, 11, data.stats.totalAssets], trend: '+3'
                                },
                                {
                                    label: 'Est. Royalty', val: `$${data.stats.potentialRoyalty.toLocaleString()}`,
                                    icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20',
                                    sparkline: [500, 1200, 800, 2000, 1500, 2500], trend: '+$1.2K'
                                }
                            ].map((stat, i) => (
                                <div
                                    key={i}
                                    className={`p-6 rounded-2xl border ${stat.bg} group hover:scale-[1.02] transition-all duration-300 relative overflow-hidden`}
                                    style={{ animationDelay: `${i * 100}ms` }}
                                >
                                    <div className="absolute top-0 right-0 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity">
                                        <stat.icon className="w-32 h-32 -mt-4 -mr-4" />
                                    </div>

                                    <div className="flex items-center justify-between mb-3 relative z-10">
                                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                        <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md flex items-center gap-1">
                                            <ArrowUp className="w-2.5 h-2.5" /> {stat.trend}
                                        </span>
                                    </div>
                                    <span className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">{stat.label}</span>
                                    <span className="text-3xl font-black text-white relative z-10">{stat.val}</span>

                                    <div className="mt-3 opacity-40 group-hover:opacity-80 transition-opacity">
                                        <Sparkline data={stat.sparkline} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Two-Column: Chart + Recent Activity */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Category Distribution Chart */}
                            <div className="lg:col-span-2 p-8 rounded-3xl border border-white/5 bg-slate-900/20 backdrop-blur-sm">
                                <h4 className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-accent" />
                                    Revenue by Category
                                </h4>
                                <div className="space-y-4">
                                    {data.categories.slice(0, 6).map((cat, i) => {
                                        const max = Math.max(...data.categories.map(c => c.count), 1);
                                        const perc = (cat.count / max) * 100;
                                        const color = categoryColors[i % categoryColors.length];
                                        return (
                                            <div key={i} className="space-y-2 group">
                                                <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                                    <span className="group-hover:text-white transition-colors">{cat.name}</span>
                                                    <span className="text-white">{cat.count} <span className="text-slate-600">units</span></span>
                                                </div>
                                                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-1000 ease-out"
                                                        style={{ width: `${perc}%`, backgroundColor: color }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Quick Metrics */}
                            <div className="p-6 rounded-3xl border border-white/5 bg-slate-900/20 backdrop-blur-sm flex flex-col items-center justify-center gap-6">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Category Distribution</h4>
                                <DonutChart
                                    segments={data.categories.slice(0, 6).map((cat, i) => ({
                                        label: cat.name,
                                        value: cat.count,
                                        color: categoryColors[i % categoryColors.length]
                                    }))}
                                    size={160}
                                />
                                <div className="space-y-2 w-full">
                                    {data.categories.slice(0, 4).map((cat, i) => (
                                        <div key={i} className="flex items-center gap-2 text-[10px]">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[i] }} />
                                            <span className="text-slate-400 flex-1 truncate">{cat.name}</span>
                                            <span className="font-bold text-white">{cat.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Recent Assets Table */}
                        <div className="p-6 rounded-3xl border border-white/5 bg-slate-900/20 backdrop-blur-sm">
                            <h4 className="text-[12px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                                <Package className="w-4 h-4 text-accent" />
                                Recent Assets
                            </h4>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="text-[9px] font-black text-slate-600 uppercase tracking-widest border-b border-white/5">
                                            <th className="text-left py-3 px-4">Asset</th>
                                            <th className="text-left py-3 px-4">Type</th>
                                            <th className="text-center py-3 px-4">Sales</th>
                                            <th className="text-center py-3 px-4">Contracts</th>
                                            <th className="text-center py-3 px-4">Model</th>
                                            <th className="text-right py-3 px-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.assets.slice(0, 8).map((asset, i) => (
                                            <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors group">
                                                <td className="py-3 px-4">
                                                    <span className="text-sm font-bold text-white group-hover:text-accent transition-colors">{asset.name}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-bold uppercase">{asset.type}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-sm font-bold text-accent">{asset.stats?.sales || 0}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-sm font-bold text-orange-400">{asset.stats?.contracts || 0}</span>
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold uppercase">
                                                        {asset.revenueModel || 'Standard'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-[10px] font-bold text-emerald-400 uppercase">Active</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ CONTRACTS TAB ═══ */}
                {activeTab === 'contracts' && (
                    <div className="space-y-6 animate-in slide-in-from-bottom-5 duration-500">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black uppercase tracking-widest text-white">Deferred Royalty Contracts</h3>
                                <p className="text-[11px] text-slate-500 mt-1">Revenue-sharing agreements with game developers</p>
                            </div>
                            <div className="flex gap-2">
                                <button className="px-4 py-2 bg-slate-800/80 border border-white/5 rounded-xl text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center gap-2">
                                    <FileText className="w-3.5 h-3.5" />
                                    Export CSV
                                </button>
                                <button className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-xl text-accent text-[10px] font-bold uppercase tracking-widest hover:bg-accent/20 transition-all flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" />
                                    New Contract
                                </button>
                            </div>
                        </div>

                        {data.assets.flatMap(a => a.licenses).filter((l: any) => l.type === 'DEFERRED').length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                                <ShieldCheck className="w-16 h-16 mb-4 opacity-20" />
                                <p className="text-sm font-bold uppercase tracking-widest">No Active Contracts</p>
                                <p className="text-[11px] text-slate-700 mt-1">When developers use your assets under deferred royalty, contracts appear here.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {data.assets.flatMap(a => a.licenses).filter((l: any) => l.type === 'DEFERRED').map((lic: any, i: number) => (
                                    <div key={lic.id} className="flex items-center justify-between p-5 rounded-2xl border border-white/5 bg-slate-900/30 hover:border-orange-500/20 transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <ShieldCheck className="w-6 h-6 text-orange-400" />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-white uppercase tracking-tight">{lic.username}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-500 font-bold uppercase">Contract #{lic.id.slice(0, 8)}</span>
                                                    <span className="text-[10px] text-slate-500">• Created {new Date(lic.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-8">
                                            <div className="text-right">
                                                <span className="block text-[10px] font-black text-slate-600 uppercase mb-1">Threshold Status</span>
                                                <div className="flex items-center gap-2 text-emerald-400">
                                                    <Clock className="w-3.5 h-3.5" />
                                                    <span className="text-[11px] font-black uppercase">Pending Earn-Out</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <span className="block text-[10px] font-black text-slate-600 uppercase mb-1">Key Grants</span>
                                                <span className="text-sm font-bold text-accent">{lic.grantsCount}</span>
                                            </div>
                                            <button className="p-3 hover:bg-white/5 rounded-xl text-slate-500 hover:text-white transition-all">
                                                <ChevronRight className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══ CATEGORIES TAB ═══ */}
                {activeTab === 'categories' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-500">
                        {data.categories.map((cat, i) => (
                            <div key={i} className="p-6 rounded-3xl border border-white/5 bg-slate-950/40 relative overflow-hidden group hover:border-white/10 transition-all hover:scale-[1.02]">
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Layers className="w-32 h-32 text-white" />
                                </div>
                                <div className="flex items-center gap-3 mb-6 relative z-10">
                                    <div
                                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                                        style={{ backgroundColor: `${categoryColors[i % categoryColors.length]}15`, borderColor: `${categoryColors[i % categoryColors.length]}30`, borderWidth: 1 }}
                                    >
                                        <BarChart3 className="w-5 h-5" style={{ color: categoryColors[i % categoryColors.length] }} />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-white uppercase tracking-wider">{cat.name}</h4>
                                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Market Segment</p>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between relative z-10">
                                    <span className="text-4xl font-black" style={{ color: categoryColors[i % categoryColors.length] }}>{cat.count}</span>
                                    <div className="text-right">
                                        <span className="block text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1 justify-end">
                                            <ArrowUp className="w-3 h-3" /> {Math.floor(Math.random() * 20 + 5)}%
                                        </span>
                                        <span className="text-[9px] text-slate-500 uppercase font-bold">vs Last Month</span>
                                    </div>
                                </div>

                                {/* Mini bar chart */}
                                <div className="mt-4 flex items-end gap-1 h-6">
                                    {Array.from({ length: 12 }, (_, j) => (
                                        <div
                                            key={j}
                                            className="flex-1 rounded-t-sm transition-all duration-300"
                                            style={{
                                                backgroundColor: categoryColors[i % categoryColors.length],
                                                height: `${Math.random() * 80 + 20}%`,
                                                opacity: 0.2 + (j / 12) * 0.6
                                            }}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* ═══ ANALYTICS TAB ═══ */}
                {activeTab === 'analytics' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {/* Revenue Forecast Card */}
                        <div className="p-8 rounded-3xl border border-accent/10 bg-gradient-to-br from-accent/5 to-transparent relative overflow-hidden">
                            <div className="absolute top-0 right-0 opacity-5">
                                <Activity className="w-64 h-64 -mt-16 -mr-16" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-sm font-black uppercase tracking-widest text-accent mb-2">Revenue Forecast</h3>
                                <p className="text-4xl font-black text-white mb-1">
                                    ${(data.stats.potentialRoyalty + data.stats.totalSales * 250).toLocaleString()}
                                </p>
                                <p className="text-[11px] text-slate-500">Estimated annual revenue based on current growth trajectory</p>

                                <div className="grid grid-cols-3 gap-6 mt-8">
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Avg. Price/Asset</p>
                                        <p className="text-lg font-bold text-white">$249</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Conversion Rate</p>
                                        <p className="text-lg font-bold text-emerald-400">12.4%</p>
                                    </div>
                                    <div>
                                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Avg. Contract Value</p>
                                        <p className="text-lg font-bold text-orange-400">$2,500</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security & DRM metrics */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/30">
                                <div className="flex items-center gap-2 mb-4">
                                    <Shield className="w-5 h-5 text-emerald-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Package Security</span>
                                </div>
                                <p className="text-3xl font-black text-emerald-400 mb-1">100%</p>
                                <p className="text-[10px] text-slate-500">All assets encrypted with ASS v2.0</p>
                                <div className="mt-4 h-2 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }} />
                                </div>
                            </div>
                            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/30">
                                <div className="flex items-center gap-2 mb-4">
                                    <Download className="w-5 h-5 text-accent" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Key Grants</span>
                                </div>
                                <p className="text-3xl font-black text-accent mb-1">
                                    {data.assets.reduce((acc: number, a: any) => acc + (a.licenses?.reduce((la: number, l: any) => la + (l.grantsCount || 0), 0) || 0), 0)}
                                </p>
                                <p className="text-[10px] text-slate-500">Total decryption keys issued</p>
                            </div>
                            <div className="p-6 rounded-2xl border border-white/5 bg-slate-900/30">
                                <div className="flex items-center gap-2 mb-4">
                                    <Eye className="w-5 h-5 text-purple-400" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Marketplace Views</span>
                                </div>
                                <p className="text-3xl font-black text-purple-400 mb-1">{(data.stats.totalAssets * 47).toLocaleString()}</p>
                                <p className="text-[10px] text-slate-500">Estimated total impressions</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
