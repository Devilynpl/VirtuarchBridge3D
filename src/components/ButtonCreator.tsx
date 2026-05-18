'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, Type, Image as ImageIcon, Palette, RefreshCw } from 'lucide-react';
import * as Icons from 'lucide-react'; // Import all icons for selection

interface ButtonCreatorProps {
    onClose?: () => void;
}

export default function ButtonCreator({ onClose }: ButtonCreatorProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [text, setText] = useState('BUTTON');
    const [fontSize, setFontSize] = useState(40);
    const [textColor, setTextColor] = useState('#ffffff');
    const [iconName, setIconName] = useState<keyof typeof Icons | 'none'>('Zap');
    const [iconSize, setIconSize] = useState(64);
    const [iconColor, setIconColor] = useState('#ffffff');
    const [textY, setTextY] = useState(0); // Offset from center
    const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
    const [fontLoaded, setFontLoaded] = useState(false);

    // Load assets
    useEffect(() => {
        const img = new Image();
        img.src = '/button_base.png';
        img.onload = () => setBaseImage(img);

        const font = new FontFace('AgentOrange', 'url(/fonts/AGENTORANGE.TTF)');
        font.load().then((loadedFont) => {
            document.fonts.add(loadedFont);
            setFontLoaded(true);
        });
    }, []);

    // Draw canvas
    useEffect(() => {
        if (!canvasRef.current || !baseImage || !fontLoaded) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw Base
        ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

        // Draw Icon
        if (iconName !== 'none') {
            const IconComponent = Icons[iconName as keyof typeof Icons] as React.ElementType;
            // Since we can't render React component to canvas directly easily without extra libs,
            // we will try to use an SVG string approach for Lucide icons or simple text based icons if needed.
            // Actually, Lucide icons are SVGs. We can render them to an image and draw.
            
            // Hacky way to get SVG string for Lucide icon:
            // We'll create a temporary DOM element to render the icon string
            // But wait, Lucide-react components return React Elements.
            // Let's use a simpler approach: Draw the icon as text if possible? No, icons are paths.
            // Alternative: Use an SVG string template. Lucide doesn't export SVG strings directly in the react package easily.
            
            // Let's try to fetch the SVG content or use a known set of paths.
            // OR: Since we are in a browser, we can serialize the SVG component? No.
            
            // Better approach for this MVP: 
            // Just use text for now, or fetch icon as image if available. 
            // BUT user asked for "Icons". 
            
            // Let's try to render the icon to a data URL using a hidden container?
            // Actually, we can use `ReactDOMServer.renderToStaticMarkup` if we install `react-dom/server`.
            // But let's try to avoid adding dependencies.
            
            // Let's assume for now we just draw text. 
            // Wait, I can use a trick: `createElement` -> string? No.
            
            // Let's use a placeholder square for icon or try to draw it if I can get path data.
            // Lucide icons have `createLucideIcon`.
            
            // PLAN B: Use a standard font icon? Or just stick to text for now?
            // User asked for "Icons".
            
            // Let's use a predefined set of SVG paths for common icons or...
            // Let's try to load the icon as an image from a CDN? 
            // `https://unpkg.com/lucide-static@latest/icons/${kebab-case-name}.svg`
            
            const kebabName = (iconName as string).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
            const iconImg = new Image();
            iconImg.crossOrigin = "Anonymous";
            iconImg.src = `https://unpkg.com/lucide-static@latest/icons/${kebabName}.svg`;
            
            // We need to handle async loading inside this effect, which is tricky.
            // Let's just do it.
            iconImg.onload = () => {
                // We need to tint the SVG. This is hard with `drawImage`.
                // For now, let's just draw it black/white (default) or rely on filter.
                
                // To colorize: draw to temp canvas, composite 'source-in' with color.
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = iconSize;
                tempCanvas.height = iconSize;
                const tCtx = tempCanvas.getContext('2d');
                if (tCtx) {
                    tCtx.drawImage(iconImg, 0, 0, iconSize, iconSize);
                    tCtx.globalCompositeOperation = 'source-in';
                    tCtx.fillStyle = iconColor;
                    tCtx.fillRect(0, 0, iconSize, iconSize);
                    
                    // Draw to main canvas
                    const x = (canvas.width - iconSize) / 2;
                    const y = (canvas.height - iconSize) / 2 - 20; // Slightly up to make room for text
                    ctx.drawImage(tempCanvas, x, y);
                }
            };
        }

        // Draw Text
        ctx.fillStyle = textColor;
        ctx.font = `${fontSize}px AgentOrange`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Shadow/Glow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        const x = canvas.width / 2;
        const y = (canvas.height / 2) + textY + (iconName !== 'none' ? 30 : 0);
        ctx.fillText(text, x, y);

        // Reset shadow
        ctx.shadowColor = 'transparent';

    }, [baseImage, fontLoaded, text, fontSize, textColor, iconName, iconSize, iconColor, textY]);

    const handleDownload = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        link.download = `button_${text}.png`;
        link.href = canvasRef.current.toDataURL();
        link.click();
    };

    // Filter icons for performance (taking first 100 or common ones)
    const commonIcons = [
        'Zap', 'Activity', 'Settings', 'User', 'Box', 'Home', 'Search', 
        'Globe', 'Wifi', 'Battery', 'Bluetooth', 'Cast', 'Cpu', 'Database',
        'Disc', 'HardDrive', 'Headphones', 'Image', 'Key', 'Keyboard',
        'Laptop', 'Layers', 'Layout', 'Link', 'Lock', 'Mail', 'Map',
        'Maximize', 'Menu', 'MessageCircle', 'Mic', 'Monitor', 'Moon',
        'Mouse', 'Move', 'Music', 'Navigation', 'Package', 'Pause',
        'Phone', 'Play', 'Power', 'Printer', 'Radio', 'RefreshCw',
        'Save', 'Scale', 'Scan', 'ScreenShare', 'Server', 'Share',
        'Shield', 'Shuffle', 'Smartphone', 'Speaker', 'Square', 'Star',
        'StopCircle', 'Sun', 'Tablet', 'Tag', 'Target', 'Terminal',
        'Thermometer', 'ThumbsUp', 'ToggleLeft', 'Tool', 'Trash', 'Truck',
        'Tv', 'Type', 'Umbrella', 'Unlock', 'Upload', 'UserPlus',
        'Video', 'Voicemail', 'Volume', 'Watch', 'Wifi', 'Wind', 'X',
        'Youtube', 'ZoomIn', 'ZoomOut'
    ];

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-5xl bg-[#020617] border border-white/10 rounded-3xl shadow-2xl flex overflow-hidden h-[80vh]">
                
                {/* Preview Area */}
                <div className="flex-1 bg-slate-900/50 flex items-center justify-center p-10 relative">
                    <div className="bg-[url('/transparency_grid.png')] rounded-2xl p-8 border border-white/5 shadow-2xl">
                        <canvas 
                            ref={canvasRef} 
                            width={512} 
                            height={512} 
                            className="w-[400px] h-[400px] object-contain"
                        />
                    </div>
                    
                    <div className="absolute bottom-6 left-6 text-xs text-slate-500 font-mono">
                        PREVIEW 512x512
                    </div>
                </div>

                {/* Controls */}
                <div className="w-[400px] bg-slate-950 border-l border-white/10 p-6 flex flex-col gap-6 overflow-y-auto">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-black text-white uppercase tracking-widest">Button Creator</h2>
                        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 hover:text-white">
                            <Icons.X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Text Control */}
                    <div className="space-y-3">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Type className="w-4 h-4" /> Text Content
                        </label>
                        <input 
                            type="text" 
                            value={text} 
                            onChange={e => setText(e.target.value.toUpperCase())}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white font-bold focus:outline-none focus:border-accent"
                        />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Size</label>
                                <input 
                                    type="number" 
                                    value={fontSize} 
                                    onChange={e => setFontSize(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Y Offset</label>
                                <input 
                                    type="number" 
                                    value={textY} 
                                    onChange={e => setTextY(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                />
                            </div>
                        </div>
                        <input 
                            type="color" 
                            value={textColor} 
                            onChange={e => setTextColor(e.target.value)}
                            className="w-full h-8 rounded-lg cursor-pointer"
                        />
                    </div>

                    {/* Icon Control */}
                    <div className="space-y-3 pt-4 border-t border-white/5">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" /> Icon
                        </label>
                        <select 
                            value={iconName} 
                            onChange={e => setIconName(e.target.value as any)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-accent appearance-none"
                        >
                            <option value="none">None</option>
                            {commonIcons.map(icon => (
                                <option key={icon} value={icon}>{icon}</option>
                            ))}
                        </select>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Size</label>
                                <input 
                                    type="number" 
                                    value={iconSize} 
                                    onChange={e => setIconSize(Number(e.target.value))}
                                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 mb-1 block">Color</label>
                                <input 
                                    type="color" 
                                    value={iconColor} 
                                    onChange={e => setIconColor(e.target.value)}
                                    className="w-full h-9 rounded-lg cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1" />

                    <button 
                        onClick={handleDownload}
                        className="w-full py-4 bg-accent hover:bg-accent-hover text-slate-950 font-black rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(56,189,248,0.3)] hover:shadow-[0_0_30px_rgba(56,189,248,0.5)]"
                    >
                        <Download className="w-5 h-5" />
                        DOWNLOAD PNG
                    </button>
                </div>
            </div>
        </div>
    );
}
