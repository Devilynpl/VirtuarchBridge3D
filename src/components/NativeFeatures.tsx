'use client';

import { useState } from 'react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Toast } from '@capacitor/toast';
import { Smartphone, Camera as CameraIcon, Share2, Vibrate, CheckCircle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

export default function NativeFeatures() {
    const isNative = Capacitor.isNativePlatform();
    const [lastAction, setLastAction] = useState<string>('');

    const takePhoto = async () => {
        try {
            await Haptics.impact({ style: ImpactStyle.Medium });
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                source: CameraSource.Camera
            });
            setLastAction(`Photo taken: ${image.webPath?.slice(0, 20)}...`);
            await Toast.show({ text: 'Photo captured successfully!' });
        } catch (error) {
            console.error('Camera error:', error);
            setLastAction('Camera cancelled or failed');
        }
    };

    const shareApp = async () => {
        try {
            await Haptics.impact({ style: ImpactStyle.Light });
            await Share.share({
                title: 'Check out Bridge Mobile',
                text: 'Managing 3D assets on the go!',
                url: 'https://bridge.virtuarch.pl/',
                dialogTitle: 'Share with friends',
            });
            setLastAction('Shared successfully');
        } catch (error) {
            console.error('Share error:', error);
        }
    };

    const testHaptics = async () => {
        await Haptics.vibrate();
        setLastAction('Haptics tested');
    };

    if (!isNative) {
        return (
            <div className="p-4 bg-slate-900/50 border border-white/5 rounded-xl mb-4">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Smartphone className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">Web Mode Detected</span>
                </div>
                <p className="text-xs text-slate-500">Native features (Camera, Haptics) are simulated or disabled in browser.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 bg-slate-900/50 border border-white/5 rounded-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-accent" />
                Native Controls
            </h3>
            
            <div className="grid grid-cols-3 gap-3">
                <button 
                    onClick={takePhoto}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-black/40 hover:bg-white/5 rounded-xl border border-white/5 transition-all active:scale-95"
                >
                    <CameraIcon className="w-6 h-6 text-indigo-400" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Camera</span>
                </button>

                <button 
                    onClick={shareApp}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-black/40 hover:bg-white/5 rounded-xl border border-white/5 transition-all active:scale-95"
                >
                    <Share2 className="w-6 h-6 text-emerald-400" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Share</span>
                </button>

                <button 
                    onClick={testHaptics}
                    className="flex flex-col items-center justify-center gap-2 p-4 bg-black/40 hover:bg-white/5 rounded-xl border border-white/5 transition-all active:scale-95"
                >
                    <Vibrate className="w-6 h-6 text-rose-400" />
                    <span className="text-[10px] text-slate-400 uppercase font-bold">Haptics</span>
                </button>
            </div>

            {lastAction && (
                <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2 mt-2">
                    <CheckCircle className="w-3 h-3 text-emerald-500" />
                    {lastAction}
                </div>
            )}
        </div>
    );
}
