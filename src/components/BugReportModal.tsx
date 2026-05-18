'use client';

import { useState } from 'react';
import { X, Bug, Loader2, Send, AlertCircle, ChevronRight, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface BugReportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function BugReportModal({ isOpen, onClose }: BugReportModalProps) {
    const [subject, setSubject] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const res = await fetch('/api/bug-report', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ subject, description, steps }),
            });

            if (!res.ok) throw new Error('Failed to submit bug report');

            toast.success('Zgłoszenie wysłane pomyślnie!', {
                style: { background: '#1e293b', color: '#fff', border: '1px solid rgba(239, 68, 68, 0.2)' }
            });
            onClose();
            setSubject('');
            setDescription('');
            setSteps('');
        } catch (error) {
            console.error(error);
            toast.error('Błąd wysyłania. Spróbuj ponownie.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <div className="glass w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                            <Bug className="w-4.5 h-4.5 text-red-400" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-slate-100">Zgłoś błąd</h2>
                            <p className="text-[10px] text-slate-500 font-mono">Bug Report System</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-1.5 rounded-lg hover:bg-slate-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="space-y-4">
                        {/* Subject */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Temat zgłoszenia</label>
                            <input
                                type="text"
                                required
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Krótki opis problemu..."
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-slate-600"
                            />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Opis błędu</label>
                            <textarea
                                required
                                rows={4}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Co się stało? Co nie działa poprawnie?"
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-slate-600 resize-none"
                            />
                        </div>

                        {/* Steps */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Kroki do odtworzenia</label>
                            <textarea
                                rows={2}
                                value={steps}
                                onChange={(e) => setSteps(e.target.value)}
                                placeholder="1. Kliknąłem... 2. Wybrałem... (opcjonalnie)"
                                className="w-full bg-slate-900/50 border border-slate-700/50 rounded-2xl px-4 py-3 text-[11px] text-slate-300 focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-slate-600 resize-none"
                            />
                        </div>
                    </div>

                    <div className="bg-red-500/5 border border-red-500/10 rounded-2xl p-3 flex gap-3">
                        <AlertCircle className="w-4 h-4 text-red-400/50 shrink-0 mt-0.5" />
                        <p className="text-[10px] text-slate-400 leading-relaxed italic">
                            Twoje zgłoszenie zostanie wysłane bezpośrednio do zespołu deweloperskiego. Dołączamy automatycznie logi systemowe, aby łatwiej było nam naprawić problem.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-2xl border border-slate-700/50 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all text-xs font-bold uppercase tracking-widest"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-[2] py-3.5 rounded-2xl bg-red-600 text-white font-black uppercase tracking-widest text-xs flex items-center justify-center gap-2.5 hover:bg-red-500 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-red-900/20"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Wysyłanie...</>
                            ) : (
                                <><Send className="w-4 h-4" /> Wyślij zgłoszenie <ChevronRight className="w-4 h-4 opacity-50" /></>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
