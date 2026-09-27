import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useProductStore } from '../../store/useProductStore';
import { PRODUCT_CONFIG } from '../../config/product';

export function StudioLighting() {
  const scrollProgress = useProductStore((state) => state.scrollProgress);
  const finish = useProductStore((state) => state.finish);
  const currentFinish = PRODUCT_CONFIG.finishes[finish];

  const rimRef1 = useRef();
  const rimRef2 = useRef();

  // Subtle breathing animation for studio lights
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (rimRef1.current) {
      rimRef1.current.intensity = 1.2 + Math.sin(t * 1.5) * 0.2;
    }
    if (rimRef2.current) {
      rimRef2.current.intensity = 1.0 + Math.cos(t * 1.2) * 0.2;
    }
  });

  // Calculate reveal factor from darkness: starts low, ramps up quickly in stage 1
  const revealLight = Math.min(1, Math.max(0.15, scrollProgress * 2.5 + 0.15));

  return (
    <group>
      {/* Deep baseline ambient - prevents absolute clipping while keeping rich blacks */}
      <ambientLight intensity={0.25 * revealLight} color="#0f172a" />

      {/* Main Studio Key Light (Top-right softbox) */}
      <directionalLight
        position={[6, 8, 5]}
        intensity={2.2 * revealLight}
        color="#ffffff"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={20}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-bias={-0.0001}
      />

      {/* Secondary Fill Light (Cool blue-gray) */}
      <directionalLight
        position={[-6, 2, 4]}
        intensity={0.8 * revealLight}
        color="#94a3b8"
      />

      {/* Sharp Rim 1 (Grazing edge highlighter from behind) */}
      <spotLight
        ref={rimRef1}
        position={[-5, 4, -4]}
        target-position={[0, 0, 0]}
        intensity={1.8}
        color="#e2e8f0"
        angle={0.6}
        penumbra={0.8}
      />

      {/* Sharp Rim 2 (Product Accent tint grazing bottom/right) */}
      <spotLight
        ref={rimRef2}
        position={[5, -2, -3]}
        target-position={[0, 0, 0]}
        intensity={1.5}
        color={currentFinish?.accentGlow || '#22c55e'}
        angle={0.7}
        penumbra={1}
      />

      {/* Floating Under-glow reflecting on ground plane */}
      <pointLight
        position={[0, -1.8, 0]}
        intensity={0.9 * revealLight}
        color={currentFinish?.accentGlow || '#22c55e'}
        distance={4}
      />
    </group>
  );
}
