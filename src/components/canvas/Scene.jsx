import React, { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, ContactShadows } from '@react-three/drei';
import { StudioLighting } from './StudioLighting';
import { ProductModel } from './ProductModel';
import { CameraController } from './CameraController';
import { useProductStore } from '../../store/useProductStore';

// WebGL Fallback component if device/browser doesn't support WebGL
function WebGLFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 text-emerald-400">
        ⚡
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Visualização 3D Indisponível</h3>
      <p className="text-sm max-w-md">
        Seu navegador ou dispositivo desativou a aceleração gráfica por hardware. O restante da experiência continua disponível abaixo.
      </p>
    </div>
  );
}

export function Scene() {
  const isFreeOrbit = useProductStore((state) => state.isFreeOrbit);
  const setIsLoaded = useProductStore((state) => state.setIsLoaded);
  const [hasWebGL, setHasWebGL] = useState(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }
  }, []);

  return (
    <div className={`canvas-container ${isFreeOrbit ? 'canvas-interactive' : ''}`}>
      {!hasWebGL ? (
        <WebGLFallback />
      ) : (
        <Canvas
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
          }}
          dpr={[1, typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1]}
          camera={{ fov: 42, position: [0, 0.4, 5.8] }}
          onCreated={() => setIsLoaded(true)}
        >
          <Suspense fallback={null}>
            <AdaptiveDpr pixelated={false} />
            
            {/* Cinematic Studio Lighting Setup */}
            <StudioLighting />

            {/* Core 3D Product & Exploded Assemblies */}
            <ProductModel />

            {/* GSAP Scroll Camera Rig & 360 Orbit Controller */}
            <CameraController />

            {/* Realistic Contact Shadow on Floor */}
            <ContactShadows
              position={[0, -1.6, 0]}
              opacity={0.65}
              scale={9}
              blur={2.4}
              far={4.5}
              color="#000000"
            />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
