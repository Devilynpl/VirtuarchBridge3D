'use client';

import { useState } from 'react';
import { Download, Lock, CheckCircle2, Box } from 'lucide-react';
import { useParams } from 'next/navigation';
import toast from 'react-hot-toast';

export default function ShareDownloadPage() {
    const params = useParams();
    const shareId = params?.id as string || '';
    const [password, setPassword] = useState('');
    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownload = () => {
        if (!password) {
            toast.error('Wpisz hasło / Enter password');
            return;
        }

        setIsDownloading(true);
        // Using window.open or window.location ensures browser native download
        const downloadUrl = `/api/transfer/download-shared?id=${shareId}&pw=${encodeURIComponent(password)}`;

        // Simple ping to check if pass is correct before we try navigating
        fetch(downloadUrl, { method: 'HEAD' })
            .then(res => {
                if (res.ok) {
                    window.location.href = downloadUrl;
                    toast.success('Pobieranie rozpoczęte...');
                } else {
                    toast.error('Nieprawidłowe hasło lub link wygasł.');
                }
            })
            .catch(() => toast.error('Blad polaczenia z serwerem'))
            .finally(() => setIsDownloading(false));
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 flex-col font-sans selection:bg-accent/30 relative overflow-hidden">
            {/* Background effects */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(56,189,248,0.15),transparent_50%)]" />

            <div className="w-full max-w-sm relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex flex-col items-center mb-10">
                    <div className="w-20 h-20 bg-accent/10 rounded-3xl flex items-center justify-center border border-accent/20 mb-6 shadow-[0_0_40px_rgba(56,189,248,0.2)]">
                        <Box className="w-10 h-10 text-accent" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter mb-2">3DBRIDGE</h1>
                    <div className="px-3 py-1 bg-accent/10 text-accent text-[10px] font-bold uppercase tracking-widest rounded-full border border-accent/20">
                        Secure Collection
                    </div>
                </div>

                <div className="glass p-8 rounded-3xl border border-white/5 shadow-2xl space-y-6">
                    <div className="text-center space-y-2">
                        <h2 className="text-white font-bold text-lg">Pobierz zasoby</h2>
                        <p className="text-slate-400 text-sm">Zasoby chronione hasłem. Dostęp udzielany ekskluzywnie dla Twojego studia.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Studio Password</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-slate-900/80 border border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-xl text-white focus:border-accent focus:outline-none transition-all placeholder:text-slate-700"
                            />
                            <Lock className="w-5 h-5 text-slate-500 absolute left-4 top-4.5" />
                        </div>
                    </div>

                    <button
                        onClick={handleDownload}
                        disabled={isDownloading || !password}
                        className="w-full py-4 rounded-2xl bg-accent text-slate-950 font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(56,189,248,0.3)] mt-6"
                    >
                        <Download className="w-5 h-5" />
                        {isDownloading ? 'Weryfikacja...' : 'Pobierz Plik ZIP'}
                    </button>

                    <div className="flex items-center justify-center gap-2 text-slate-500 text-xs mt-4">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>AES-256 Transport Security</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
