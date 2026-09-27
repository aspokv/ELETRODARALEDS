import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useProductStore } from '../../store/useProductStore';

export function LoadingScreen() {
  const isLoaded = useProductStore((state) => state.isLoaded);
  const [percent, setPercent] = useState(12);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsFinished(true), 400);
          return 100;
        }
        return prev + Math.floor(Math.random() * 15 + 8);
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isLoaded]);

  return (
    <AnimatePresence>
      {!isFinished && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }}
          className="fixed inset-0 z-50 bg-[#050507] flex flex-col items-center justify-between p-8 sm:p-12 font-mono select-none"
        >
          {/* Top Telemetry */}
          <div className="w-full flex items-center justify-between text-xs text-slate-500">
            <span>ELETRODARA // 3D CORE</span>
            <span className="text-emerald-400">INIT // 2026</span>
          </div>

          {/* Center Brand and Big Number */}
          <div className="text-center">
            <div className="text-[11px] tracking-widest text-slate-400 uppercase mb-2">
              CALIBRANDO EXPERIÊNCIA 3D
            </div>
            <div className="text-7xl sm:text-9xl font-black tracking-tighter text-white">
              {Math.min(100, percent)}%
            </div>
            <div className="text-xs text-emerald-400 font-bold tracking-widest uppercase mt-4">
              {percent < 40 && '[CARREGANDO ARQUITETURA MONOLÍTICA]'}
              {percent >= 40 && percent < 80 && '[CALIBRANDO SENSORES DE TELEMETRIA]'}
              {percent >= 80 && '[SISTEMA PRONTO · INICIANDO EXPERIÊNCIA]'}
            </div>
          </div>

          {/* Bottom Progress Line */}
          <div className="w-full max-w-md">
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-emerald-400"
                style={{ width: `${Math.min(100, percent)}%` }}
                transition={{ ease: 'easeOut', duration: 0.2 }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-2">
              <span>LEI 14.300 / MARCO LEGAL GD</span>
              <span>60 FPS CAPABLE</span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
