import React from 'react';
import { motion } from 'framer-motion';
import { useProductStore } from '../../store/useProductStore';
import { PRODUCT_CONFIG } from '../../config/product';

export function ConfiguratorBar() {
  const finish = useProductStore((state) => state.finish);
  const setFinish = useProductStore((state) => state.setFinish);
  const scrollProgress = useProductStore((state) => state.scrollProgress);
  const isFreeOrbit = useProductStore((state) => state.isFreeOrbit);

  const currentFinish = PRODUCT_CONFIG.finishes[finish];

  // Show bottom dock after scroll starts
  const isVisible = scrollProgress > 0.08;

  if (!isVisible && !isFreeOrbit) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] sm:w-auto p-2 sm:p-2.5 rounded-2xl bg-obsidian/90 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center justify-between sm:justify-center gap-3 sm:gap-6 pointer-events-auto"
    >
      
      {/* Current Finish Label */}
      <div className="hidden md:flex flex-col text-left pl-3 pr-2 border-r border-white/10">
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
          ACABAMENTO
        </span>
        <span className="text-xs font-bold text-white whitespace-nowrap">
          {currentFinish?.name}
        </span>
      </div>

      {/* Swatches List */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {Object.values(PRODUCT_CONFIG.finishes).map((f) => {
          const isActive = finish === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFinish(f.id)}
              className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl transition-all duration-200 group ${
                isActive ? 'scale-110 ring-2 ring-emerald-400' : 'hover:scale-105 opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: f.previewHex }}
              title={f.name}
              aria-label={`Selecionar acabamento ${f.name}`}
            >
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Action to Simulator */}
      <a
        href="#terminal"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-400/40 text-[11px] font-mono font-bold text-emerald-400 transition-colors"
      >
        <span>CALCULAR</span>
        <span>→</span>
      </a>

    </motion.div>
  );
}
