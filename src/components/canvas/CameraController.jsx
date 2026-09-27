import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { useProductStore } from '../../store/useProductStore';

export function CameraController() {
  const { camera, size } = useThree();
  const controlsRef = useRef();
  
  const isFreeOrbit = useProductStore((state) => state.isFreeOrbit);
  const scrollProgress = useProductStore((state) => state.scrollProgress);

  const isMobile = size.width < 768;

  // Keyframes for cinematic camera trajectory
  const keyframes = [
    { p: 0.00, pos: [0, 0.2, isMobile ? 8.0 : 6.4], look: [0, -0.4, 0] },
    { p: 0.25, pos: [isMobile ? 2.5 : 3.4, 1.2, isMobile ? 5.5 : 4.2], look: [0, 0, 0] },
    { p: 0.50, pos: [0.6, 0.2, isMobile ? 3.4 : 2.4], look: [0.1, 0, 0.4] },
    { p: 0.75, pos: [isMobile ? 2.2 : 3.0, 2.4, isMobile ? 6.2 : 4.8], look: [0, 0, 0] },
    { p: 1.00, pos: [0, 0.2, isMobile ? 5.6 : 4.2], look: [0, 0, 0] },
  ];

  // Helper to interpolate between camera keyframes
  function getCameraTarget(progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    
    // Find surrounding keyframes
    let i = 0;
    while (i < keyframes.length - 1 && keyframes[i + 1].p <= clamped) {
      i++;
    }
    const k1 = keyframes[i];
    const k2 = keyframes[Math.min(i + 1, keyframes.length - 1)];

    if (k1.p === k2.p) {
      return { pos: new THREE.Vector3(...k1.pos), look: new THREE.Vector3(...k1.look) };
    }

    const t = (clamped - k1.p) / (k2.p - k1.p);
    // Smooth cosine easing between checkpoints
    const easedT = 0.5 - 0.5 * Math.cos(t * Math.PI);

    const pos = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...k1.pos),
      new THREE.Vector3(...k2.pos),
      easedT
    );
    const look = new THREE.Vector3().lerpVectors(
      new THREE.Vector3(...k1.look),
      new THREE.Vector3(...k2.look),
      easedT
    );

    return { pos, look };
  }

  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((state, delta) => {
    if (isFreeOrbit) {
      // Free orbit mode: OrbitControls has full control
      return;
    }

    const { pos, look } = getCameraTarget(scrollProgress);

    // Subtle pointer parallax (inertial mouse tracking)
    const parallaxX = state.pointer.x * (isMobile ? 0.15 : 0.35);
    const parallaxY = state.pointer.y * (isMobile ? 0.1 : 0.25);

    const targetPos = new THREE.Vector3(
      pos.x + parallaxX,
      pos.y + parallaxY,
      pos.z
    );

    // Dampened camera smoothing
    camera.position.lerp(targetPos, delta * 4);
    currentLookAt.current.lerp(look, delta * 4);
    camera.lookAt(currentLookAt.current);
  });

  return (
    <>
      {isFreeOrbit && (
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enablePan={false}
          enableZoom={true}
          minDistance={isMobile ? 3.0 : 2.2}
          maxDistance={isMobile ? 8.5 : 7.0}
          dampingFactor={0.05}
          rotateSpeed={0.8}
        />
      )}
    </>
  );
}
