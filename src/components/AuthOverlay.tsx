'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LogIn, UserPlus, Mail, Lock, User as UserIcon, Loader2, Check, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '@/context/LanguageContext';

type AuthTab = 'login' | 'register';

export default function AuthOverlay() {
    const { login, user, isLoading } = useAuth();
    const { t, language, setLanguage } = useLanguage();
    const [isOpen, setIsOpen] = useState(false);
    type AuthTab = 'login' | 'register' | 'forgot' | 'reset';
    const [activeTab, setActiveTab] = useState<AuthTab>('login');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Login form
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register form
    const [regUsername, setRegUsername] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPassword, setRegPassword] = useState('');

    // Verification
    const [verificationCode, setVerificationCode] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifyEmail, setVerifyEmail] = useState('');

    // Forgot Password
    const [forgotEmail, setForgotEmail] = useState('');

    // Reset Password
    const [resetCode, setResetCode] = useState('');
    const [resetNewPassword, setResetNewPassword] = useState('');
    const [resetConfirmPassword, setResetConfirmPassword] = useState('');

    useEffect(() => {
        const handleOpen = async (e: any) => {
            if (e.detail?.isRegister) {
                // Instantly generate and login
                toast.loading('Generowanie unikalnego nicku i łączenie...', { id: 'instant-auth' });
                const nick = `nickbeta${Math.floor(1000 + Math.random() * 9000)}`;
                const email = `${nick}@beta.local`;
                try {
                    const res = await fetch('/api/auth/register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username: nick, email, password: 'beta' }),
                    });
                    const data = await res.json();
                    if (res.ok && data.token) {
                        login(data.token, data.user);
                        toast.success(`Zalogowano pomyślnie!\nWitaj na czacie, ${nick}!`, { id: 'instant-auth' });
                    } else {
                        toast.error(data.error || 'Błąd rejestracji', { id: 'instant-auth' });
                        setActiveTab('login');
                        setIsOpen(true);
                    }
                } catch (err) {
                    toast.error('Błąd połączenia', { id: 'instant-auth' });
                    setActiveTab('login');
                    setIsOpen(true);
                }
            } else {
                setActiveTab('login');
                setIsOpen(true);
            }
        };
        window.addEventListener('open-auth-overlay', handleOpen);
        return () => window.removeEventListener('open-auth-overlay', handleOpen);
    }, [login]);

    if (isLoading || !isOpen) return null;

    const resetForms = () => {
        setLoginEmail('');
        setLoginPassword('');
        setRegUsername('');
        setRegEmail('');
        setRegPassword('');
        setVerificationCode('');
        setIsVerifying(false);
        setVerifyEmail('');
        setForgotEmail('');
        setResetCode('');
        setResetNewPassword('');
        setResetConfirmPassword('');
    };

    const handleClose = () => {
        setIsOpen(false);
        resetForms();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: loginEmail, password: loginPassword }),
            });
            const data = await res.json();

            if (res.ok) {
                login(data.token, data.user);
                toast.success(t('auth.welcome_back') || 'Welcome back!');
                handleClose();
            } else {
                if (data.requiresVerification) {
                    setVerifyEmail(data.email);
                    setIsVerifying(true);
                    setActiveTab('register'); // Switch to register tab for verification
                    toast.error('Email not verified. Please enter your verification code.');
                } else {
                    toast.error(data.error || t('auth.error'));
                }
            }
        } catch (err) {
            toast.error(t('auth.generic_error') || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword }),
            });
            const data = await res.json();

            if (res.ok) {
                if (data.token) {
                    // Instant login (if backend allows it)
                    login(data.token, data.user);
                    toast.success(`Witaj na czacie, ${data.user.username}!`);
                    handleClose();
                } else {
                    // Verification required
                    setVerifyEmail(regEmail);
                    setIsVerifying(true);
                    toast.success(t('auth.verify_sent') || 'Verification code sent!');
                }
            } else {
                toast.error(data.error || t('auth.error'));
            }
        } catch (err) {
            toast.error(t('auth.generic_error') || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleInstantGenerate = async () => {
        setIsSubmitting(true);
        toast.loading('Generowanie konta...', { id: 'instant-auth' });
        const nick = `nickbeta${Math.floor(1000 + Math.random() * 9000)}`;
        const email = `${nick}@beta.local`;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: nick, email, password: 'beta' }),
            });
            const data = await res.json();

            if (res.ok && data.token) {
                login(data.token, data.user);
                toast.success(`Witaj na czacie, ${nick}!`, { id: 'instant-auth' });
                handleClose();
            } else {
                toast.error(data.error || t('auth.error'), { id: 'instant-auth' });
            }
        } catch (err) {
            toast.error(t('auth.generic_error') || 'Something went wrong', { id: 'instant-auth' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: verifyEmail, code: verificationCode }),
            });
            const data = await res.json();

            if (res.ok) {
                login(data.token, data.user);
                toast.success(t('auth.verified_success'));
                handleClose();
            } else {
                toast.error(data.error || t('auth.error'));
            }
        } catch (err) {
            toast.error(t('auth.generic_error') || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        toast.loading('Resending...', { id: 'resend' });
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword }),
            });
            if (res.ok) toast.success(t('auth.verify_sub'), { id: 'resend' });
            else toast.error(t('auth.generic_error'), { id: 'resend' });
        } catch (e) {
            toast.error(t('auth.generic_error'), { id: 'resend' });
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: forgotEmail }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(language === 'pl' ? 'Kod do resetowania hasła został wysłany!' : 'Password reset code sent!');
                setActiveTab('reset');
            } else {
                toast.error(data.error || t('auth.error'));
            }
        } catch (err) {
            toast.error(t('auth.generic_error') || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (resetNewPassword !== resetConfirmPassword) {
            toast.error(language === 'pl' ? 'Hasła nie pasują do siebie' : 'Passwords do not match');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: forgotEmail,
                    token: resetCode,
                    newPassword: resetNewPassword
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(language === 'pl' ? 'Hasło zostało pomyślnie zmienione!' : 'Password updated successfully!');
                setActiveTab('login');
                setResetCode('');
                setResetNewPassword('');
                setResetConfirmPassword('');
            } else {
                toast.error(data.error || t('auth.error'));
            }
        } catch (err) {
            toast.error(t('auth.generic_error') || 'Something went wrong');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-md" onClick={handleClose} />
            <div className="relative w-full max-w-md glass p-8 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header Actions (Language & Close) */}
                <div className="absolute top-4 right-4 flex items-center gap-2">
                    <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5">
                        <button
                            onClick={() => setLanguage('en')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${language === 'en' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-white'}`}
                        >
                            EN
                        </button>
                        <button
                            onClick={() => setLanguage('pl')}
                            className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all ${language === 'pl' ? 'bg-accent text-slate-950' : 'text-slate-400 hover:text-white'}`}
                        >
                            PL
                        </button>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-1.5 hover:bg-white/5 rounded-xl text-slate-500 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Logo */}
                <div className="flex flex-col items-center mb-6">
                    <div className="w-16 h-16 bg-accent/20 rounded-2xl flex items-center justify-center mb-4 overflow-hidden">
                        {isVerifying ? (
                            <Mail className="w-8 h-8 text-accent" />
                        ) : (
                            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
                        )}
                    </div>

                    {isVerifying ? (
                        <>
                            <h2 className="text-2xl font-bold text-white text-center">{t('auth.verify_title')}</h2>
                            <p className="text-slate-400 text-sm mt-1 text-center">{t('auth.verify_sub')}</p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl font-bold text-white text-center">
                                {activeTab === 'login' ? t('auth.welcome') : activeTab === 'forgot' ? (language === 'pl' ? 'Resetowanie hasła' : 'Reset Password') : activeTab === 'reset' ? (language === 'pl' ? 'Nowe hasło' : 'New Password') : t('auth.create_account')}
                            </h2>
                            <p className="text-slate-400 text-sm mt-1 text-center">
                                {activeTab === 'login' ? t('auth.login_sub') : activeTab === 'forgot' ? (language === 'pl' ? 'Wpisz swój email, aby otrzymać instrukcje' : 'Enter your email to receive instructions') : activeTab === 'reset' ? (language === 'pl' ? 'Wpisz kod z emaila i nowe hasło' : 'Enter the code from your email and a new password') : t('auth.register_sub')}
                            </p>
                        </>
                    )}
                </div>

                {/* Tab Switcher (hidden during verification) */}
                {!isVerifying && (
                    <div className="flex bg-slate-900/60 p-1 rounded-xl border border-white/5 mb-6">
                        <button
                            onClick={() => setActiveTab('login')}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'login'
                                ? 'bg-accent text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <LogIn className="w-4 h-4" />
                            {t('auth.sign_in')}
                        </button>
                        <button
                            onClick={() => setActiveTab('register')}
                            disabled={isSubmitting}
                            className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeTab === 'register'
                                ? 'bg-accent text-slate-950 shadow-[0_0_15px_rgba(56,189,248,0.3)]'
                                : 'text-slate-400 hover:text-white'
                                }`}
                        >
                            <UserPlus className="w-4 h-4" />
                            {t('auth.sign_up')}
                        </button>
                    </div>
                )}

                {/* ─── VERIFICATION FORM ─── */}
                {isVerifying && (
                    <form onSubmit={handleVerify} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.verify_code')}</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    maxLength={8}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all text-center font-mono text-xl tracking-[0.5em]"
                                    placeholder="XXXXXXXX"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-80 disabled:saturate-50"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                            {t('auth.verify_btn')}
                        </button>

                        <div className="flex items-center justify-between mt-4">
                            <button
                                type="button"
                                onClick={() => { setIsVerifying(false); }}
                                className="text-slate-400 hover:text-white text-sm transition-colors flex items-center gap-1"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                {t('chat.back') || 'Back'}
                            </button>
                            <button
                                type="button"
                                onClick={handleResend}
                                className="text-accent hover:text-white text-[10px] uppercase font-bold tracking-widest"
                            >
                                {t('auth.resend')}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── LOGIN FORM ─── */}
                {!isVerifying && activeTab === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="name@example.com"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
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
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                            {t('auth.sign_in')}
                        </button>

                        <div className="flex justify-center mt-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('forgot')}
                                className="text-slate-400 hover:text-white text-xs transition-colors underline-offset-4 hover:underline"
                            >
                                {language === 'pl' ? 'Zapomniałeś hasła?' : 'Forgot Password?'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── FORGOT PASSWORD FORM ─── */}
                {!isVerifying && activeTab === 'forgot' && (
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="name@example.com"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-80 disabled:saturate-50"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                            {language === 'pl' ? 'Wyślij link' : 'Send Reset Link'}
                        </button>
                        <div className="flex justify-center mt-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('login')}
                                className="text-slate-400 hover:text-white text-xs transition-colors underline-offset-4 hover:underline flex items-center gap-1"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                {t('auth.back_to_login') || 'Wróć'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── RESET PASSWORD CODE FORM ─── */}
                {!isVerifying && activeTab === 'reset' && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{language === 'pl' ? 'KOD WERYFIKACYJNY' : 'VERIFICATION CODE'}</label>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    value={resetCode}
                                    onChange={(e) => setResetCode(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all text-center tracking-widest font-mono text-lg"
                                    placeholder="123456"
                                    maxLength={6}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{language === 'pl' ? 'NOWE HASŁO' : 'NEW PASSWORD'}</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={resetNewPassword}
                                    onChange={(e) => setResetNewPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{language === 'pl' ? 'POTWIERDŹ HASŁO' : 'CONFIRM PASSWORD'}</label>
                            <div className="relative">
                                <Check className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={resetConfirmPassword}
                                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-80 disabled:saturate-50"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                            {language === 'pl' ? 'Ustaw nowe hasło' : 'Set New Password'}
                        </button>
                        <div className="flex justify-center mt-4 pt-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('forgot')}
                                className="text-slate-400 hover:text-white text-xs transition-colors underline-offset-4 hover:underline flex items-center gap-1"
                            >
                                <ArrowLeft className="w-3 h-3" />
                                {t('auth.back_to_login') || 'Wróć'}
                            </button>
                        </div>
                    </form>
                )}

                {/* ─── REGISTER FORM ─── */}
                {!isVerifying && activeTab === 'register' && (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.username') || 'USERNAME'}</label>
                            <div className="relative">
                                <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    required
                                    value={regUsername}
                                    onChange={(e) => setRegUsername(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="Username"
                                    minLength={3}
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.email')}</label>
                            <div className="relative">
                                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="email"
                                    required
                                    value={regEmail}
                                    onChange={(e) => setRegEmail(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="name@example.com"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-500 ml-1">{t('auth.password')}</label>
                            <div className="relative">
                                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="password"
                                    required
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-4 pr-12 text-white focus:border-accent outline-none transition-all"
                                    placeholder="••••••••"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full bg-accent hover:bg-accent-hover text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2 mt-6 active:scale-95 disabled:opacity-80 disabled:saturate-50"
                        >
                            {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                            {t('auth.sign_up')}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
