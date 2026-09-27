import { create } from 'zustand';

export const useProductStore = create((set) => ({
  finish: 'obsidian',
  setFinish: (finish) => set({ finish }),

  scrollProgress: 0,
  setScrollProgress: (scrollProgress) => set({ scrollProgress }),

  activeSection: 0,
  setActiveSection: (activeSection) => set({ activeSection }),

  explodedProgress: 0,
  setExplodedProgress: (explodedProgress) => set({ explodedProgress }),

  activeHotspot: null,
  setActiveHotspot: (activeHotspot) => set({ activeHotspot }),

  isFreeOrbit: false,
  setIsFreeOrbit: (isFreeOrbit) => set({ isFreeOrbit }),

  billValue: 600,
  setBillValue: (billValue) => set({ billValue }),

  isLoaded: false,
  setIsLoaded: (isLoaded) => set({ isLoaded }),
}));
