import React from 'react';
import { useGLTF } from '@react-three/drei';

export function ModelLoader({ url, ...props }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene} {...props} />;
}
