'use client';

import React, { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Environment, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import {
    Loader2, X, Maximize2, Minimize2, Settings, Box, Image as ImageIcon,
    Info, Eye, EyeOff, Grid3x3, Sun, Moon, RotateCcw, Camera, Triangle,
    Layers, Cpu, Zap
} from 'lucide-react';
import * as THREE from 'three';

interface ThreeViewerProps {
    filePath: string;
    onClose?: () => void;
}

interface MeshStats {
    triangles: number;
    vertices: number;
    meshCount: number;
    materials: number;
    boundingBox: { x: number; y: number; z: number };
}

// ═══════════════════════════════════════
//  Model Loader — GLB/GLTF/OBJ/FBX
// ═══════════════════════════════════════
const Model = ({ path: modelPath, onStatsUpdate }: { path: string; onStatsUpdate: (stats: MeshStats) => void }) => {
    const ext = modelPath.split('.').pop()?.toLowerCase();
    const groupRef = useRef<THREE.Group>(null);

    // GLB/GLTF loader
    if (ext === 'glb' || ext === 'gltf') {
        const { scene } = useGLTF(modelPath);

        useEffect(() => {
            if (scene) {
                let triangles = 0;
                let vertices = 0;
                let meshCount = 0;
                const materialSet = new Set<string>();

                scene.traverse((child: any) => {
                    if (child.isMesh) {
                        meshCount++;
                        const geo = child.geometry;
                        if (geo.index) {
                            triangles += geo.index.count / 3;
                        } else if (geo.attributes.position) {
                            triangles += geo.attributes.position.count / 3;
                        }
                        if (geo.attributes.position) {
                            vertices += geo.attributes.position.count;
                        }
                        if (child.material) {
                            const matName = Array.isArray(child.material)
                                ? child.material.map((m: any) => m.name || m.uuid).join(',')
                                : (child.material.name || child.material.uuid);
                            materialSet.add(matName);
                        }
                    }
                });

                const box = new THREE.Box3().setFromObject(scene);
                const size = new THREE.Vector3();
                box.getSize(size);

                onStatsUpdate({
                    triangles: Math.round(triangles),
                    vertices,
                    meshCount,
                    materials: materialSet.size,
                    boundingBox: {
                        x: parseFloat(size.x.toFixed(2)),
                        y: parseFloat(size.y.toFixed(2)),
                        z: parseFloat(size.z.toFixed(2))
                    }
                });
            }
        }, [scene]);

        return <primitive object={scene} ref={groupRef} />;
    }

    // Fallback: placeholder geometry
    return (
        <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#38bdf8" wireframe />
        </mesh>
    );
};

// ═══════════════════════════════════════
//  Animated Auto-Rotate Controller
// ═══════════════════════════════════════
const AutoRotate = ({ enabled }: { enabled: boolean }) => {
    const { scene } = useThree();
    useFrame((_, delta) => {
        if (enabled && scene.children.length > 0) {
            scene.rotation.y += delta * 0.3;
        }
    });
    return null;
};

// ═══════════════════════════════════════
//  Performance Monitor (FPS)
// ═══════════════════════════════════════
const FPSMonitor = ({ onFpsUpdate }: { onFpsUpdate: (fps: number) => void }) => {
    const frameCount = useRef(0);
    const lastTime = useRef(performance.now());

    useFrame(() => {
        frameCount.current++;
        const now = performance.now();
        if (now - lastTime.current >= 1000) {
            onFpsUpdate(frameCount.current);
            frameCount.current = 0;
            lastTime.current = now;
        }
    });
    return null;
};

export default function ThreeViewer({ filePath, onClose }: ThreeViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [stats, setStats] = useState<MeshStats>({
        triangles: 0, vertices: 0, meshCount: 0, materials: 0,
        boundingBox: { x: 0, y: 0, z: 0 }
    });
    const [showWireframe, setShowWireframe] = useState(false);
    const [showGrid, setShowGrid] = useState(true);
    const [autoRotate, setAutoRotate] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [fps, setFps] = useState(0);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatNumber = (n: number) => {
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toString();
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#020617] flex flex-col font-sans overflow-hidden">
            {/* ═══ Top Bar ═══ */}
            <div className="h-12 border-b border-white/5 px-6 flex items-center justify-between bg-black/40 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-accent/20 rounded-lg text-accent">
                        <Box className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-white uppercase tracking-widest">3DBRIDGE<span className="text-accent">view</span></h1>
                        <p className="text-[10px] text-slate-500 font-mono truncate max-w-md">{filePath}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    {/* View Controls */}
                    <div className="flex items-center gap-0.5 bg-black/30 p-1 rounded-xl border border-white/5 mr-4">
                        <button
                            onClick={() => setShowGrid(!showGrid)}
                            className={`p-2 rounded-lg transition-all ${showGrid ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-white'}`}
                            title="Toggle Grid"
                        >
                            <Grid3x3 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setShowWireframe(!showWireframe)}
                            className={`p-2 rounded-lg transition-all ${showWireframe ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-white'}`}
                            title="Toggle Wireframe"
                        >
                            <Triangle className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setAutoRotate(!autoRotate)}
                            className={`p-2 rounded-lg transition-all ${autoRotate ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-white'}`}
                            title="Auto Rotate"
                        >
                            <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-2 rounded-lg transition-all text-slate-500 hover:text-white`}
                            title="Toggle Background"
                        >
                            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                    </div>

                    <button
                        onClick={toggleFullscreen}
                        className="p-2 hover:bg-white/5 rounded-xl transition-colors text-slate-400 hover:text-white"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-red-500/20 rounded-xl transition-colors text-slate-400 hover:text-red-400 ml-2"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* ═══ Viewport ═══ */}
            <div className={`flex-1 relative ${darkMode ? 'bg-[radial-gradient(circle_at_center,_#0f172a_0%,_#020617_100%)]' : 'bg-[radial-gradient(circle_at_center,_#e2e8f0_0%,_#cbd5e1_100%)]'}`}>
                <Canvas shadows dpr={[1, 2]} camera={{ fov: 45 }}>
                    <Suspense fallback={null}>
                        <Stage environment="city" intensity={0.5} shadows="contact">
                            <Model path={filePath} onStatsUpdate={setStats} />
                        </Stage>
                    </Suspense>
                    <OrbitControls makeDefault />
                    <AutoRotate enabled={autoRotate} />
                    <FPSMonitor onFpsUpdate={setFps} />
                    {showGrid && (
                        <Grid
                            args={[20, 20]}
                            cellSize={0.5}
                            cellThickness={0.5}
                            cellColor={darkMode ? '#1e293b' : '#94a3b8'}
                            sectionSize={2}
                            sectionThickness={1}
                            sectionColor={darkMode ? '#334155' : '#64748b'}
                            fadeDistance={25}
                            fadeStrength={1}
                            position={[0, -0.01, 0]}
                        />
                    )}
                    <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
                        <GizmoViewport axisColors={['#ef4444', '#22c55e', '#3b82f6']} labelColor="white" />
                    </GizmoHelper>
                </Canvas>

                {/* Loading Overlay */}
                <Suspense fallback={
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                        <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Loading Geometry...</p>
                    </div>
                }>
                    <div />
                </Suspense>

                {/* ═══ Mesh Inspector Panel ═══ */}
                <div className="absolute bottom-6 left-6 flex flex-col gap-4">
                    <div className="glass p-5 rounded-2xl border border-white/5 space-y-4 min-w-[240px] backdrop-blur-xl">
                        <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-white/5 pb-3">
                            <Info className="w-4 h-4 text-accent" />
                            Mesh Inspector
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                                    <Triangle className="w-3 h-3" /> Triangles
                                </p>
                                <p className="text-lg font-black font-mono text-accent">{formatNumber(stats.triangles)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                                    <Cpu className="w-3 h-3" /> Vertices
                                </p>
                                <p className="text-lg font-black font-mono text-white">{formatNumber(stats.vertices)}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> Meshes
                                </p>
                                <p className="text-sm font-bold font-mono text-slate-300">{stats.meshCount}</p>
                            </div>
                            <div>
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> Materials
                                </p>
                                <p className="text-sm font-bold font-mono text-emerald-400">{stats.materials}</p>
                            </div>
                        </div>

                        {stats.boundingBox.x > 0 && (
                            <div className="pt-3 border-t border-white/5">
                                <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2">Bounding Box (m)</p>
                                <div className="flex gap-3 text-[11px] font-mono">
                                    <span className="text-red-400">X: {stats.boundingBox.x}</span>
                                    <span className="text-green-400">Y: {stats.boundingBox.y}</span>
                                    <span className="text-blue-400">Z: {stats.boundingBox.z}</span>
                                </div>
                            </div>
                        )}

                        <div className="pt-3 border-t border-white/5">
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Format</p>
                            <p className="text-xs font-mono text-white">{filePath.split('.').pop()?.toUpperCase()} • Scale 1:1</p>
                        </div>
                    </div>
                </div>

                {/* Right Side Quick Actions */}
                <div className="absolute top-6 right-6">
                    <div className="flex flex-col gap-2">
                        <button
                            className="p-3 glass rounded-2xl border border-white/10 text-slate-400 hover:text-accent hover:border-accent/40 transition-all shadow-2xl"
                            title="Screenshot"
                        >
                            <Camera className="w-5 h-5" />
                        </button>
                        <button
                            className="p-3 glass rounded-2xl border border-white/10 text-slate-400 hover:text-accent hover:border-accent/40 transition-all shadow-2xl"
                            title="Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ Professional Status Bar ═══ */}
            <div className="h-8 bg-black/60 border-t border-white/5 px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${fps > 30 ? 'bg-emerald-500' : fps > 15 ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {fps} FPS
                        </span>
                    </div>
                    <div className="h-3 w-px bg-white/10" />
                    <span className="text-[10px] font-bold text-slate-500">WebGL 2.0</span>
                    <div className="h-3 w-px bg-white/10" />
                    <span className="text-[10px] font-bold text-slate-500">
                        {formatNumber(stats.triangles)} tris • {formatNumber(stats.vertices)} verts
                    </span>
                </div>
                <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest opacity-60">© 3DBridge Studio — Engine v3.0</span>
                </div>
            </div>
        </div>
    );
}
