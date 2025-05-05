import React, { useState, useEffect } from 'react';
import cryptoService from '../utils/crypto-service';

/**
 * Componente de controles de desenvolvimento para depuração
 */
const DevControls: React.FC = () => {
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [useRealScraper, setUseRealScraper] = useState(false);
  const [scraperUrl, setScraperUrl] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Inicialização do estado com base nas configurações atuais
    const isDev = cryptoService.isDevModeEnabled();
    setDevModeEnabled(isDev);
    
    // Verificar as variáveis de ambiente ou localStorage para useRealScraper
    const useReal = localStorage.getItem('useRealScraper') === 'true';
    setUseRealScraper(useReal);
    
    // Recuperar a URL do scraper salva
    const savedUrl = localStorage.getItem('scraperUrl') || 'http://localhost:5000/api/roulettes';
    setScraperUrl(savedUrl);
  }, []);

  const toggleDevMode = () => {
    const newMode = !devModeEnabled;
    cryptoService.enableDevMode(newMode);
    setDevModeEnabled(newMode);
    console.log(`[DevControls] Modo de desenvolvimento ${newMode ? 'ativado' : 'desativado'}`);
  };

  const toggleRealScraper = () => {
    const newMode = !useRealScraper;
    setUseRealScraper(newMode);
    console.log(`[DevControls] Uso do scraper real ${newMode ? 'ativado' : 'desativado'}`);
  };

  const updateScraperUrl = (e: React.ChangeEvent<HTMLInputElement>) => {
    setScraperUrl(e.target.value);
  };

  const saveSettings = () => {
    // Salvar configurações no localStorage
    localStorage.setItem('useRealScraper', useRealScraper.toString());
    localStorage.setItem('scraperUrl', scraperUrl);
    
    // Recarregar a página para aplicar as mudanças
    console.log('[DevControls] Configurações salvas. Recarregando aplicação...');
    window.location.reload();
  };

  const forceUpdate = () => {
    // Disparar evento para forçar atualização dos dados
    const event = new CustomEvent('forceDataUpdate');
    window.dispatchEvent(event);
    console.log('[DevControls] Forçando atualização de dados...');
  };

  if (!devModeEnabled && !expanded) {
    return (
      <button 
        onClick={() => setExpanded(true)}
        className="fixed bottom-4 right-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg z-50"
        style={{ width: '40px', height: '40px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
      >
        🛠️
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg z-50 w-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">Controles de Desenvolvimento</h3>
        <button 
          onClick={() => setExpanded(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span>Modo de Desenvolvimento</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={devModeEnabled}
              onChange={toggleDevMode}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div className="flex items-center justify-between">
          <span>Usar Scraper Real</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={useRealScraper}
              onChange={toggleRealScraper}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">URL do Scraper</label>
          <input
            type="text"
            value={scraperUrl}
            onChange={updateScraperUrl}
            className="w-full p-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        
        <div className="flex space-x-2 pt-2">
          <button
            onClick={saveSettings}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md"
          >
            Salvar
          </button>
          <button
            onClick={forceUpdate}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md"
          >
            Atualizar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DevControls; 