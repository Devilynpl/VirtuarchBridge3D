import React, { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, useGLTF, Environment } from '@react-three/drei';
import * as THREE from 'three';

export interface MeshStats {
    triangles: number;
    vertices: number;
    meshCount: number;
    materials: number;
    boundingBox: { x: number; y: number; z: number };
}

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
        }, [scene, onStatsUpdate]);

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

export default function ModelPreview({ url, onStatsUpdate }: { url: string; onStatsUpdate: (stats: MeshStats) => void }) {
    return (
        <div className="w-full h-full bg-[#020617] rounded-xl overflow-hidden relative">
            <Canvas shadows dpr={[1, 2]} camera={{ fov: 45 }}>
                <Suspense fallback={null}>
                    <Stage environment="city" intensity={0.5} shadows="contact">
                        <Model path={url} onStatsUpdate={onStatsUpdate} />
                    </Stage>
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={0.5} enableDamping />
            </Canvas>
        </div>
    );
}
