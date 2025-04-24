import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Interface para o estado das configurações da roleta
interface RouletteSettingsState {
  // Configurações de som
  enableSound: boolean;
  setEnableSound: (enable: boolean) => void;
  
  // Configurações de notificações
  enableNotifications: boolean;
  setEnableNotifications: (enable: boolean) => void;
  
  // Configurações de atualização automática
  autoRefreshInterval: number;
  setAutoRefreshInterval: (intervalSeconds: number) => void;
  
  // Preferências de visualização
  showStatistics: boolean;
  setShowStatistics: (show: boolean) => void;
  
  // Resetar para configurações padrão
  resetSettings: () => void;
}

// Criar o store com persistência local
export const useRouletteSettingsStore = create<RouletteSettingsState>()(
  persist(
    (set) => ({
      // Valores padrão
      enableSound: false,
      enableNotifications: true,
      autoRefreshInterval: 5, // 5 segundos
      showStatistics: true,
      
      // Métodos para atualizar o estado
      setEnableSound: (enable: boolean) => set({ enableSound: enable }),
      setEnableNotifications: (enable: boolean) => set({ enableNotifications: enable }),
      setAutoRefreshInterval: (intervalSeconds: number) => set({ autoRefreshInterval: intervalSeconds }),
      setShowStatistics: (show: boolean) => set({ showStatistics: show }),
      
      // Resetar para valores padrão
      resetSettings: () => set({
        enableSound: false,
        enableNotifications: true,
        autoRefreshInterval: 5,
        showStatistics: true,
      }),
    }),
    {
      name: 'roulette-settings', // Nome no localStorage
      version: 1, // Versão para possíveis migrações futuras
    }
  )
);

export default useRouletteSettingsStore; 