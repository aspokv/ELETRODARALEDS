import React from 'react';
import { useProductStore } from '../../store/useProductStore';
import { PRODUCT_CONFIG } from '../../config/product';

export function Header() {
  const isFreeOrbit = useProductStore((state) => state.isFreeOrbit);
  const setIsFreeOrbit = useProductStore((state) => state.setIsFreeOrbit);

  const scrollToTerminal = () => {
    const el = document.getElementById('terminal');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 px-4 sm:px-8 py-4 sm:py-5 flex items-center justify-between pointer-events-auto backdrop-blur-md bg-obsidian/40 border-b border-white/5 transition-all">
      
      {/* Brand & Technical Code */}
      <div className="flex items-center gap-4">
        <a href="#hero" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-sm tracking-tight text-white uppercase">Eletrodara</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                AETHER
              </span>
            </div>
            <span className="block text-[9px] font-mono text-slate-400 tracking-widest uppercase">
              ENERGIA SOLAR POR ASSINATURA
            </span>
          </div>
        </a>

        {/* Regulatory Badge (Desktop) */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 text-[11px] font-mono text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>LEI 14.300 · HOMOLOGADO ANEEL</span>
        </div>
      </div>

      {/* Right Controls: 360° Switch + Direct CTA */}
      <div className="flex items-center gap-2 sm:gap-3">
        
        {/* Toggle 360 Free Orbit Button */}
        <button
          onClick={() => setIsFreeOrbit(!isFreeOrbit)}
          className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all duration-300 border ${
            isFreeOrbit
              ? 'bg-emerald-500 text-obsidian border-emerald-400 shadow-lg shadow-emerald-500/20'
              : 'bg-white/5 text-slate-300 border-white/10 hover:border-emerald-400/50 hover:text-white'
          }`}
          title="Alternar entre modo cinematográfico e rotação 360 livre"
        >
          <svg className={`w-3.5 h-3.5 ${isFreeOrbit ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="hidden sm:inline">
            {isFreeOrbit ? 'ROTACIONAR 360° (ATIVO)' : 'INSPEÇÃO 360°'}
          </span>
        </button>

        {/* Institutional CTA Button */}
        <button
          onClick={scrollToTerminal}
          className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-obsidian font-extrabold text-xs px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95"
        >
          <span>SOLICITAR COTA</span>
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>

      </div>

    </header>
  );
}
