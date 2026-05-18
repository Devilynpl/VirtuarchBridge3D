'use client';

import { Canvas, useThree } from '@react-three/fiber';
import { Float, PresentationControls, Sphere, Environment } from '@react-three/drei';
import { useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { Suspense, useRef, forwardRef, useImperativeHandle } from 'react';

interface SpherePreviewProps {
    albedoUrl?: string;
    normalUrl?: string;
    roughnessUrl?: string;
    displacementUrl?: string;
    aoUrl?: string;
    normalIntensity?: number;
    size?: number;
    interactive?: boolean;
    onCanvasReady?: (capturer: () => string) => void;
}

export default function SpherePreview({ albedoUrl, normalUrl, roughnessUrl, normalIntensity = 1, size = 1, interactive = false, onCanvasReady }: SpherePreviewProps) {
    return (
        <div className="w-full h-full relative group bg-[#020b1c]">
            <Canvas
                shadows
                dpr={[1, 2]}
                camera={{ position: [0, 0, 2.5], fov: 45 }}
                gl={{ preserveDrawingBuffer: true, antialias: true }}
                onCreated={({ gl }) => {
                    if (onCanvasReady) {
                        onCanvasReady(() => gl.domElement.toDataURL('image/png'));
                    }
                }}
            >
                <Suspense fallback={null}>
                    <ambientLight intensity={0.4} />
                    <directionalLight position={[5, 5, 5]} intensity={0.5} castShadow />
                    <pointLight position={[-5, -5, -5]} intensity={0.2} color="#38bdf8" />

                    <PresentationControls
                        global
                        {...{
                            config: { mass: 2, tension: 500 },
                            snap: true,
                            rotation: [0, 0.3, 0],
                            polar: [-Math.PI / 3, Math.PI / 3],
                            azimuth: [-Math.PI / 1.4, Math.PI / 1.4]
                        } as any}
                    >
                        <Float rotationIntensity={0.5} floatIntensity={0.3} speed={2}>
                            <TexturedSphere
                                albedoUrl={albedoUrl}
                                normalUrl={normalUrl}
                                roughnessUrl={roughnessUrl}
                                normalIntensity={normalIntensity}
                            />
                        </Float>
                    </PresentationControls>

                    <Environment preset="city" />
                </Suspense>
            </Canvas>
            {!interactive && (
                <div className="absolute inset-0 bg-transparent cursor-pointer" />
            )}
        </div>
    );
}

function TexturedSphere({ albedoUrl, normalUrl, roughnessUrl, normalIntensity = 1 }: any) {
    const maps: any = {};

    if (albedoUrl) maps.map = useLoader(THREE.TextureLoader, albedoUrl);
    if (normalUrl) maps.normalMap = useLoader(THREE.TextureLoader, normalUrl);

    // If we have an ORD map, apply it to several channels
    if (roughnessUrl) {
        const ord = useLoader(THREE.TextureLoader, roughnessUrl);
        maps.roughnessMap = ord;
        maps.aoMap = ord;
        maps.displacementMap = ord;
    }

    // Apply high-quality settings to textures
    Object.values(maps).forEach((map: any) => {
        if (map) {
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            map.anisotropy = 16;
            map.minFilter = THREE.LinearMipmapLinearFilter;
            map.magFilter = THREE.LinearFilter;
            map.repeat.set(1, 1);
        }
    });

    return (
        <Sphere args={[0.7, 128, 128]} rotation={[0, -Math.PI / 2, 0]}>
            <meshStandardMaterial
                {...maps}
                roughness={roughnessUrl ? 0.8 : 0.6}
                metalness={0.05}
                normalScale={normalUrl ? new THREE.Vector2(normalIntensity, normalIntensity) : new THREE.Vector2(1, 1)}
                displacementScale={roughnessUrl ? 0.05 : 0}
                aoMapIntensity={1.0}
            />
        </Sphere>
    );
}
