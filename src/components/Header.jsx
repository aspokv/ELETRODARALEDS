import React from 'react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-white/90 border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
        <a href="#topo" className="flex items-center min-w-0">
          <img src="/logo.png" alt="Eletrodara Gestão de Energia" width="762" height="164" className="h-7 min-[400px]:h-8 sm:h-10 w-auto" />
        </a>

        <a
          href="#cadastro"
          className="shrink-0 whitespace-nowrap inline-flex items-center bg-brand hover:bg-brand-dark text-white font-bold text-sm px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-colors"
        >
          <span className="sm:hidden">Simular</span>
          <span className="hidden sm:inline">Simular economia</span>
        </a>
      </div>
    </header>
  );
}
