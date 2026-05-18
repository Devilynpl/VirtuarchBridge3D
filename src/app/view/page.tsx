'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import ThreeViewer from '@/components/ThreeViewer';
import { Loader2 } from 'lucide-react';

function ViewContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [filePath, setFilePath] = useState<string | null>(null);

    useEffect(() => {
        if (!searchParams) return;
        const path = searchParams.get('file');
        if (path) {
            setFilePath(path);
        } else {
            console.warn('No file path provided in query params.');
        }
    }, [searchParams]);

    if (!filePath) {
        return (
            <div className="h-screen w-screen bg-[#020617] flex flex-col items-center justify-center text-slate-500 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-accent/50" />
                <div className="text-center">
                    <p className="text-sm font-black uppercase tracking-[0.2em] text-white">3DBRIDGE Engine</p>
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Initializing Streamer...</p>
                </div>
            </div>
        );
    }

    return (
        <ThreeViewer
            filePath={filePath}
            onClose={() => {
                if (window.confirm('Close Viewer?')) {
                    window.close();
                }
            }}
        />
    );
}

export default function ViewPage() {
    return (
        <Suspense fallback={
            <div className="h-screen w-screen bg-[#020617] flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-accent" />
            </div>
        }>
            <ViewContent />
        </Suspense>
    );
}
