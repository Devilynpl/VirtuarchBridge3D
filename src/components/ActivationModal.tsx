'use client';

import { useState, useEffect } from 'react';
import { X, Key, CheckCircle2, AlertCircle, Loader2, Sparkles, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

export default function ActivationModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [currency, setCurrency] = useState<'USD' | 'EUR' | 'GBP' | 'PLN'>('USD');
    const { token, user } = useAuth();

    const PRICING = {
        USD: { symbol: '$', plans: [{ users: 3, price: 5 }, { users: 6, price: 10 }, { users: 12, price: 15 }, { users: 30, price: 25 }] },
        EUR: { symbol: '€', plans: [{ users: 3, price: 5 }, { users: 6, price: 10 }, { users: 12, price: 15 }, { users: 30, price: 25 }] },
        GBP: { symbol: '£', plans: [{ users: 3, price: 4 }, { users: 6, price: 8 }, { users: 12, price: 12 }, { users: 30, price: 20 }] },
        PLN: { symbol: 'zł', plans: [{ users: 3, price: 20 }, { users: 6, price: 40 }, { users: 12, price: 60 }, { users: 30, price: 100 }] }
    };

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('open-activation-modal', handleOpen);
        return () => window.removeEventListener('open-activation-modal', handleOpen);
    }, []);

    const handleActivate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!code.trim() || !token) return;

        setLoading(true);
        try {
            const res = await fetch('/api/auth/activate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ code: code.trim() })
            });

            const data = await res.json();

            if (res.ok) {
                toast.success('License activated successfully! Relogging to update status...');
                // Usually we should update user state, but let's reload for simplicity or update token
                setTimeout(() => {
                    window.location.reload();
                }, 2000);
                setIsOpen(false);
            } else {
                toast.error(data.error || 'Failed to activate');
            }
        } catch (err) {
            toast.error('Network error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" onClick={() => setIsOpen(false)} />

            <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden glass animate-in zoom-in-95 duration-300">
                <div className="p-8 grid md:grid-cols-2 gap-8">
                    {/* Left Side: Activation */}
                    <div>
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-accent/20 rounded-xl flex items-center justify-center text-accent">
                                    <Key className="w-6 h-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-white tracking-tight">Activate Bridge</h2>
                                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Premium License</p>
                                </div>
                            </div>
                        </div>

                        <div className="mb-8 space-y-4">
                            <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl flex items-start gap-4">
                                <Sparkles className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-white mb-1">Unlock All Features</p>
                                    <ul className="text-[11px] text-slate-400 space-y-1">
                                        <li className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                            Unlimited Blender Exports
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                            Global Community Chat
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                                            Advanced Asset Requests
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleActivate} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 block px-1">
                                    Activation Code
                                </label>
                                <input
                                    value={code}
                                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                                    placeholder="XXXX-XXXX-XXXX-XXXX"
                                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white font-mono text-center tracking-widest focus:border-accent outline-none transition-all placeholder:opacity-20 uppercase"
                                    autoFocus
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading || !code.trim()}
                                className="w-full py-4 bg-accent text-slate-900 rounded-2xl font-black uppercase tracking-widest text-sm hover:scale-[1.02] shadow-lg shadow-accent/20 disabled:opacity-80 disabled:saturate-50 disabled:hover:scale-100 transition-all flex items-center justify-center gap-3"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                                Activate Premium
                            </button>
                        </form>
                    </div>

                    {/* Right Side: Plans */}
                    <div className="border-l border-white/5 pl-8 flex flex-col">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Select Plan</h3>
                            <div className="flex bg-black/40 rounded-lg p-1 gap-1">
                                {(['USD', 'EUR', 'GBP', 'PLN'] as const).map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setCurrency(c)}
                                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${currency === c ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 space-y-3 overflow-y-auto pr-2">
                            {PRICING[currency].plans.map((plan, i) => (
                                <a
                                    key={i}
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); toast.success(`Selected plan: ${plan.users} Users`); }}
                                    className="block p-4 bg-slate-800/50 border border-white/5 rounded-2xl hover:border-accent/50 hover:bg-slate-800 transition-all group relative overflow-hidden"
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center border border-white/5 font-black text-slate-400 group-hover:text-accent group-hover:border-accent transition-colors">
                                                {plan.users}
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-white uppercase tracking-wider group-hover:text-accent transition-colors">
                                                    {plan.users === 1 ? 'Single User' : `${plan.users} Users Team`}
                                                </p>
                                                <p className="text-[10px] text-slate-500">Full Access License</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-lg font-black text-white">
                                                {PRICING[currency].symbol}{plan.price}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="absolute inset-0 bg-accent/5 translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                                </a>
                            ))}
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-white/5 text-center">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-slate-500 hover:text-white transition-colors"
                            >
                                Close Window
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
