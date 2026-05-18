'use client';

import { useLanguage } from '@/context/LanguageContext';
import { Languages } from 'lucide-react';

export default function LanguageSwitch() {
    const { language, setLanguage } = useLanguage();

    return (
        <div className="flex items-center gap-1 bg-slate-900/40 p-1 rounded-xl glass border border-white/5 shadow-sm">
            <button
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 ${language === 'en'
                        ? 'bg-accent text-slate-950 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                EN
            </button>
            <button
                onClick={() => setLanguage('pl')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all duration-300 ${language === 'pl'
                        ? 'bg-accent text-slate-950 shadow-lg'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
            >
                PL
            </button>
        </div>
    );
}
