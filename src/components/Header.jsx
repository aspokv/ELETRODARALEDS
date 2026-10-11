import React from 'react';

export function Header() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-md bg-obsidian/80 border-b border-white/5">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <a href="#topo" className="flex items-center">
          <img src="/logo-white.png" alt="Eletrodara Gestão de Energia" width="762" height="164" className="h-9 sm:h-10 w-auto" />
        </a>

        <a
          href="#cadastro"
          className="inline-flex items-center bg-emerald-500 hover:bg-emerald-400 text-obsidian font-bold text-sm px-4 py-2.5 rounded-xl transition-colors"
        >
          Simular economia
        </a>
      </div>
    </header>
  );
}
