import { Loader2 } from 'lucide-react';

export default function Loading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <p className="text-slate-400 font-mono text-[10px] animate-pulse uppercase tracking-[0.3em]">
                Loading System Modules...
            </p>
        </div>
    );
}
