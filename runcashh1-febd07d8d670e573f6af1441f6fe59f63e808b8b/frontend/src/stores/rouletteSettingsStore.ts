import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Interface para o estado das configurações da roleta
interface RouletteSettingsState {
  // Configurações de som
  enableSound: boolean;
  enableNotifications: boolean;
  enableVibration: boolean;
  showPredictions: boolean;
  autoScroll: boolean;
  darkMode: boolean;
  
  // Métodos
  toggleSound: () => void;
  toggleNotifications: () => void;
  toggleVibration: () => void;
  togglePredictions: () => void;
  toggleAutoScroll: () => void;
  toggleDarkMode: () => void;
  resetSettings: () => void;
}

// Criar o store com persistência local
export const useRouletteSettingsStore = create<RouletteSettingsState>()(
  persist(
    (set) => ({
      // Valores padrão
      enableSound: true,
      enableNotifications: true,
      enableVibration: false,
      showPredictions: true,
      autoScroll: true,
      darkMode: false,
      
      // Métodos para atualizar o estado
      toggleSound: () => set((state) => ({ enableSound: !state.enableSound })),
      toggleNotifications: () => set((state) => ({ enableNotifications: !state.enableNotifications })),
      toggleVibration: () => set((state) => ({ enableVibration: !state.enableVibration })),
      togglePredictions: () => set((state) => ({ showPredictions: !state.showPredictions })),
      toggleAutoScroll: () => set((state) => ({ autoScroll: !state.autoScroll })),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      
      // Resetar para valores padrão
      resetSettings: () => set({
        enableSound: true,
        enableNotifications: true,
        enableVibration: false,
        showPredictions: true,
        autoScroll: true,
        darkMode: false,
      }),
    }),
    {
      name: 'roulette-settings', // Nome no localStorage
      version: 1, // Versão para possíveis migrações futuras
    }
  )
);

export default useRouletteSettingsStore; 