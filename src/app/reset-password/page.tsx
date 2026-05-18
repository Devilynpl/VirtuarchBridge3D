'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Lock, Check, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

function ResetPasswordForm() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams?.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    if (!token) {
        return (
            <div className="text-center">
                <p className="text-red-400 mb-6">Brak prawidłowego tokenu / No valid token provided.</p>
                <Link href="/" className="text-accent underline hover:text-white">Wróc na stronę główną (Go Home)</Link>
            </div>
        );
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast.error('Hasła nie pasują do siebie! / Passwords do not match');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword: password }),
            });
            const data = await res.json();
            if (res.ok) {
                setSuccess(true);
                toast.success('Hasło zmienione! / Password updated!');
                setTimeout(() => {
                    router.push('/');
                }, 3000);
            } else {
                toast.error(data.error || 'Wystąpił błąd / Error occurred');
            }
        } catch (err) {
            toast.error('Wystąpił błąd / Error occurred');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (success) {
        return (
            <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                    <Check className="w-8 h-8 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white">Hasło zostało zmienione!</h2>
                <p className="text-slate-400">Za chwilę zostaniesz przekierowany na stronę główną.</p>
                <Link href="/" className="mt-8 inline-block px-6 py-2 bg-accent/20 text-accent rounded-lg font-bold hover:bg-accent/30 transition-colors">
                    Wróć do logowania
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h2 className="text-2xl font-bold text-white text-center mb-2">Resetowanie Hasła</h2>
            <p className="text-slate-400 text-sm text-center mb-8">Wpisz nowe hasło poniżej. / Enter new password below.</p>

            <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 ml-1">Nowe Hasło</label>
                <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                        placeholder="••••••••"
                        autoFocus
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-500 ml-1">Potwierdź Nowe Hasło</label>
                <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                        placeholder="••••••••"
                    />
                </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-80 disabled:saturate-50"
            >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                Zapisz Nowe Hasło
            </button>
        </form>
    );
}

export default function ResetPasswordPage() {
    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <div className="w-full max-w-md glass p-10 rounded-3xl border border-white/10 shadow-2xl">
                <Suspense fallback={<div className="text-center text-slate-400">Ładowanie / Loading...</div>}>
                    <ResetPasswordForm />
                </Suspense>
            </div>
        </div>
    );
}
