// Objeto simples sem dependências React para evitar problemas de compilação
// Este é um substituto simples para o store que seria implementado com zustand ou React Context

// Estado padrão das configurações
const defaultSettings = {
  enableSound: true,
  enableNotifications: true,
  enableVibration: false,
  showPredictions: true,
  autoScroll: true,
  darkMode: false,
};

/**
 * Store de configurações da roleta simplificado
 * Esta implementação básica retorna valores estáticos para evitar problemas de build
 */
export const useRouletteSettingsStore = () => {
  return {
    // Propriedades de estado
    enableSound: defaultSettings.enableSound,
    enableNotifications: defaultSettings.enableNotifications,
    enableVibration: defaultSettings.enableVibration,
    showPredictions: defaultSettings.showPredictions,
    autoScroll: defaultSettings.autoScroll,
    darkMode: defaultSettings.darkMode,
    
    // Métodos - implementação vazia apenas para satisfazer a interface
    toggleSound: () => console.log('toggleSound chamado'),
    toggleNotifications: () => console.log('toggleNotifications chamado'),
    toggleVibration: () => console.log('toggleVibration chamado'),
    togglePredictions: () => console.log('togglePredictions chamado'),
    toggleAutoScroll: () => console.log('toggleAutoScroll chamado'),
    toggleDarkMode: () => console.log('toggleDarkMode chamado'),
    resetSettings: () => console.log('resetSettings chamado')
  };
}; 