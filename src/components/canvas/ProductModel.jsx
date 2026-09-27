import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useProductStore } from '../../store/useProductStore';
import { PRODUCT_CONFIG } from '../../config/product';
import { ModelLoader } from './ModelLoader';

export function ProductModel() {
  const finish = useProductStore((state) => state.finish);
  const scrollProgress = useProductStore((state) => state.scrollProgress);
  const explodedProgress = useProductStore((state) => state.explodedProgress);
  const isFreeOrbit = useProductStore((state) => state.isFreeOrbit);
  const activeHotspot = useProductStore((state) => state.activeHotspot);
  const setActiveHotspot = useProductStore((state) => state.setActiveHotspot);

  const groupRef = useRef();
  const coreRef = useRef();
  const finsRef = useRef();
  const topShellRef = useRef();
  const bottomShellRef = useRef();
  const lensRef = useRef();

  const currentFinish = PRODUCT_CONFIG.finishes[finish] || PRODUCT_CONFIG.finishes.obsidian;

  // Custom model override check
  if (PRODUCT_CONFIG.modelPath) {
    return <ModelLoader url={PRODUCT_CONFIG.modelPath} />;
  }

  // Memoized materials for physical accuracy
  const shellMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(currentFinish.color),
      metalness: currentFinish.metalness,
      roughness: currentFinish.roughness,
      clearcoat: currentFinish.clearcoat,
      clearcoatRoughness: 0.1,
      reflectivity: 0.9,
    });
  }, [currentFinish]);

  const darkTitaniumMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0c0d12'),
      metalness: 0.92,
      roughness: 0.35,
    });
  }, []);

  const coreGlowMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(currentFinish.accentGlow),
      emissive: new THREE.Color(currentFinish.accentGlow),
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.8,
    });
  }, [currentFinish]);

  const glassMaterial = useMemo(() => {
    return new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      transmission: 0.92,
      opacity: 1,
      transparent: true,
      roughness: 0.05,
      ior: 1.52,
      thickness: 0.6,
      reflectivity: 0.9,
    });
  }, []);

  // Frame animation: rotation & subtle levitation
  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    if (!isFreeOrbit && groupRef.current) {
      // In Hero (scrollProgress = 0), position model lower (-0.95) so it sits gracefully below the headline
      // As user scrolls into Act II, smoothly elevate to center (0.0)
      const heroY = THREE.MathUtils.lerp(-0.95, 0.0, Math.min(1, scrollProgress * 3.2));
      groupRef.current.position.y = heroY + Math.sin(t * 1.2) * 0.04;
      groupRef.current.rotation.y += delta * 0.15;
    } else if (isFreeOrbit && groupRef.current) {
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, 0, 0.1);
    }

    // Core pulsing animation
    if (coreRef.current) {
      coreRef.current.rotation.y -= delta * 0.8;
      coreRef.current.rotation.z = Math.sin(t * 2) * 0.1;
      const pulse = 1 + Math.sin(t * 4) * 0.04;
      coreRef.current.scale.set(pulse, pulse, pulse);
    }

    // Exploded View dynamic transformations
    const exp = explodedProgress;

    if (topShellRef.current) {
      topShellRef.current.position.y = THREE.MathUtils.lerp(topShellRef.current.position.y, 0.45 + exp * 1.6, 0.1);
      topShellRef.current.rotation.x = THREE.MathUtils.lerp(topShellRef.current.rotation.x, exp * 0.3, 0.1);
    }

    if (bottomShellRef.current) {
      bottomShellRef.current.position.y = THREE.MathUtils.lerp(bottomShellRef.current.position.y, -0.45 - exp * 1.6, 0.1);
      bottomShellRef.current.rotation.x = THREE.MathUtils.lerp(bottomShellRef.current.rotation.x, -exp * 0.3, 0.1);
    }

    if (finsRef.current) {
      const s = 1 + exp * 0.5;
      finsRef.current.scale.set(s, 1, s);
      finsRef.current.rotation.y += delta * 0.3;
    }

    if (lensRef.current) {
      lensRef.current.position.z = THREE.MathUtils.lerp(lensRef.current.position.z, 0.6 + exp * 1.2, 0.1);
    }
  });

  return (
    <group ref={groupRef} dispose={null}>
      
      {/* 1. TOP SHELL ASSEMBLY */}
      <group ref={topShellRef} position={[0, 0.45, 0]}>
        {/* Main upper aerodynamic dome */}
        <mesh castShadow receiveShadow material={shellMaterial}>
          <cylinderGeometry args={[1.35, 1.45, 0.4, 48]} />
        </mesh>
        {/* Top chamfer ring */}
        <mesh position={[0, 0.22, 0]} material={darkTitaniumMaterial}>
          <torusGeometry args={[1.25, 0.06, 16, 48]} />
        </mesh>
        {/* Top laser etched precision indicator */}
        <mesh position={[0, 0.23, 0]} material={coreGlowMaterial}>
          <ringGeometry args={[0.35, 0.42, 32]} />
        </mesh>
      </group>

      {/* 2. BOTTOM SHELL ASSEMBLY */}
      <group ref={bottomShellRef} position={[0, -0.45, 0]}>
        <mesh castShadow receiveShadow material={shellMaterial}>
          <cylinderGeometry args={[1.45, 1.35, 0.4, 48]} />
        </mesh>
        {/* Magnetic docking base ring */}
        <mesh position={[0, -0.22, 0]} material={darkTitaniumMaterial}>
          <torusGeometry args={[1.25, 0.06, 16, 48]} />
        </mesh>
      </group>

      {/* 3. RADIAL HEAT DISPERSION FINS (Middle Segment) */}
      <group ref={finsRef} position={[0, 0, 0]}>
        {Array.from({ length: 16 }).map((_, i) => {
          const angle = (i / 16) * Math.PI * 2;
          const x = Math.cos(angle) * 1.32;
          const z = Math.sin(angle) * 1.32;
          return (
            <mesh key={i} position={[x, 0, z]} rotation={[0, -angle, 0]} material={darkTitaniumMaterial}>
              <boxGeometry args={[0.04, 0.5, 0.35]} />
            </mesh>
          );
        })}
      </group>

      {/* 4. INTERNAL SOLAR MAGDRIVE PLASMA CORE (The Engine) */}
      <group ref={coreRef} position={[0, 0, 0]}>
        {/* Glowing crystalline core */}
        <mesh material={coreGlowMaterial}>
          <octahedronGeometry args={[0.65, 2]} />
        </mesh>
        {/* Electromagnetic induction coils */}
        <mesh material={darkTitaniumMaterial}>
          <torusGeometry args={[0.9, 0.04, 16, 32]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={darkTitaniumMaterial}>
          <torusGeometry args={[0.95, 0.03, 16, 32]} />
        </mesh>
      </group>

      {/* 5. SAPPHIRE OPTICAL SENSOR & TELEMETRY LENS */}
      <group ref={lensRef} position={[0, 0, 0.6]}>
        <mesh material={glassMaterial}>
          <cylinderGeometry args={[0.55, 0.55, 0.1, 32]} rotation={[Math.PI / 2, 0, 0]} />
        </mesh>
        <mesh position={[0, 0, 0.06]} material={coreGlowMaterial}>
          <ringGeometry args={[0.2, 0.28, 32]} />
        </mesh>
      </group>

      {/* 6. 3D SPATIAL HOTSPOTS (Visible only during Exploded / Detail acts or Free 360 Orbit) */}
      {(isFreeOrbit || (scrollProgress >= 0.32 && scrollProgress <= 0.68)) && PRODUCT_CONFIG.hotspots.map((h) => {
        const isActive = activeHotspot === h.id;
        return (
          <group key={h.id} position={h.position}>
            <Html distanceFactor={7} center zIndexRange={[10, 0]}>
              <div className="relative group pointer-events-auto select-none">
                
                {/* Hotspot Target Reticle */}
                <button
                  onClick={() => setActiveHotspot(isActive ? null : h.id)}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 focus:outline-none ${
                    isActive ? 'scale-125' : 'hover:scale-110'
                  }`}
                  aria-label={h.title}
                >
                  <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-ping" />
                  <span className="relative w-4 h-4 rounded-full border-2 border-emerald-400 bg-obsidian flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  </span>
                </button>

                {/* Hotspot Expanded Card */}
                {isActive && (
                  <div className="absolute left-10 top-1/2 -translate-y-1/2 w-64 p-4 rounded-xl bg-obsidian/95 backdrop-blur-xl border border-white/15 shadow-2xl text-left transition-all z-50">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-mono font-bold tracking-widest text-emerald-400 uppercase">
                        {h.category}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-semibold">
                        {h.badge}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1 leading-snug">
                      {h.title}
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed mb-3">
                      {h.description}
                    </p>
                    <div className="text-[10px] font-mono text-emerald-400/80 font-bold flex items-center gap-1 border-t border-white/10 pt-2">
                      <span>METRIC:</span>
                      <span className="text-white">{h.metric}</span>
                    </div>
                  </div>
                )}

              </div>
            </Html>
          </group>
        );
      })}

    </group>
  );
}
