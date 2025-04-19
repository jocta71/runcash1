import React, { useState, useEffect } from 'react';
import { RouletteData } from '../services/data/rouletteRepository';

interface ProviderInfo {
  id: string;
  name: string;
  count: number;
}

interface RouletteFiltersProps {
  roulettes: Record<string, RouletteData>;
  onFilterChange: (filteredIds: string[]) => void;
  onViewModeChange: (viewMode: 'grid' | 'list') => void;
  onSortModeChange: (sortMode: string) => void;
}

const RouletteFilters: React.FC<RouletteFiltersProps> = ({
  roulettes,
  onFilterChange,
  onViewModeChange,
  onSortModeChange
}) => {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<string>('default');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Identifica os provedores disponíveis
  useEffect(() => {
    const rouletteCount = Object.keys(roulettes).length;
    setIsLoading(rouletteCount === 0); // Definir como carregando se não houver roletas
    
    if (rouletteCount === 0) {
      // Se não houver roletas ainda, definir provedores padrão
      const defaultProviders = [
        { id: 'Evolution Gaming', name: 'Evolution Gaming', count: 0 },
        { id: 'Pragmatic Play', name: 'Pragmatic Play', count: 0 },
        { id: 'Auto Roulettes', name: 'Auto Roulettes', count: 0 },
        { id: 'Lightning', name: 'Lightning', count: 0 },
        { id: 'Immersive', name: 'Immersive', count: 0 }
      ];
      setProviders(defaultProviders);
      return;
    }
    
    const providerMap = new Map<string, { name: string; count: number }>();
    
    Object.values(roulettes).forEach(roulette => {
      // Extrair o provedor do nome da roleta
      let providerName = 'Outros';
      
      if (!roulette || !roulette.name) return;
      
      if (roulette.name.includes('Evolution')) {
        providerName = 'Evolution Gaming';
      } else if (roulette.name.includes('Pragmatic')) {
        providerName = 'Pragmatic Play';
      } else if (roulette.name.includes('Playtech')) {
        providerName = 'Playtech';
      } else if (roulette.name.includes('VIP')) {
        providerName = 'VIP Tables';
      } else if (roulette.name.includes('Auto')) {
        providerName = 'Auto Roulettes';
      } else if (roulette.name.includes('Lightning')) {
        providerName = 'Lightning';
      } else if (roulette.name.includes('Immersive')) {
        providerName = 'Immersive';
      }
      
      // Atualizar contagem do provedor
      if (providerMap.has(providerName)) {
        const current = providerMap.get(providerName)!;
        providerMap.set(providerName, {
          name: providerName,
          count: current.count + 1
        });
      } else {
        providerMap.set(providerName, {
          name: providerName,
          count: 1
        });
      }
    });
    
    // Converter o mapa para um array
    const providerArray: ProviderInfo[] = Array.from(providerMap.entries())
      .map(([id, info]) => ({
        id,
        name: info.name,
        count: info.count
      }))
      .sort((a, b) => b.count - a.count);
    
    setProviders(providerArray);
  }, [roulettes]);

  // Aplica os filtros quando mudam
  useEffect(() => {
    if (!isLoading) {
      applyFilters();
    }
  }, [selectedProviders, searchTerm, isLoading]);

  // Função para aplicar os filtros
  const applyFilters = () => {
    if (Object.keys(roulettes).length === 0) return;
    
    let filteredIds = Object.entries(roulettes)
      .filter(([id, roulette]) => {
        if (!roulette || !roulette.name) return false;
        
        // Verificar se passa pelo filtro de provedor
        const providerMatch = selectedProviders.length === 0 || selectedProviders.some(provider => {
          if (provider === 'Evolution Gaming') return roulette.name.includes('Evolution');
          if (provider === 'Pragmatic Play') return roulette.name.includes('Pragmatic');
          if (provider === 'Playtech') return roulette.name.includes('Playtech');
          if (provider === 'VIP Tables') return roulette.name.includes('VIP');
          if (provider === 'Auto Roulettes') return roulette.name.includes('Auto');
          if (provider === 'Lightning') return roulette.name.includes('Lightning');
          if (provider === 'Immersive') return roulette.name.includes('Immersive');
          return true; // 'Outros' ou sem filtro selecionado
        });
        
        // Verificar se passa pelo filtro de pesquisa
        const searchMatch = searchTerm === '' || 
          roulette.name.toLowerCase().includes(searchTerm.toLowerCase());
        
        return providerMatch && searchMatch;
      })
      .map(([id]) => id);
    
    // Aplicar ordenação
    if (sortMode === 'name-asc') {
      filteredIds.sort((a, b) => 
        roulettes[a].name.localeCompare(roulettes[b].name)
      );
    } else if (sortMode === 'name-desc') {
      filteredIds.sort((a, b) => 
        roulettes[b].name.localeCompare(roulettes[a].name)
      );
    } else if (sortMode === 'active-first') {
      filteredIds.sort((a, b) => 
        (roulettes[b].active ? 1 : 0) - (roulettes[a].active ? 1 : 0)
      );
    }
    
    onFilterChange(filteredIds);
  };

  // Gerenciar seleção de provedor
  const handleProviderSelect = (providerId: string) => {
    if (selectedProviders.includes(providerId)) {
      setSelectedProviders(selectedProviders.filter(id => id !== providerId));
    } else {
      setSelectedProviders([...selectedProviders, providerId]);
    }
  };

  // Gerenciar alteração do modo de visualização
  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    onViewModeChange(mode);
  };

  // Gerenciar alteração do modo de ordenação
  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSortMode = event.target.value;
    setSortMode(newSortMode);
    onSortModeChange(newSortMode);
    
    // Aplicar ordenação imediatamente
    setTimeout(applyFilters, 0);
  };

  return (
    <div className="roulette-filters bg-black/40 rounded-lg p-4 mb-6 sticky top-0 z-10">
      <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
        <div className="search-box flex-grow">
          <input
            type="text"
            placeholder="Pesquisar roletas..."
            className="w-full bg-black/40 border border-green-500/30 rounded px-4 py-2 text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
          />
        </div>
        
        <div className="controls flex gap-4">
          <div className="view-mode-toggle flex border border-green-500/30 rounded overflow-hidden">
            <button
              onClick={() => handleViewModeChange('grid')}
              className={`px-3 py-1 ${viewMode === 'grid' ? 'bg-green-600/80' : 'bg-black/60'}`}
              title="Visualização em grade"
              disabled={isLoading}
            >
              <span className="icon">□□</span>
            </button>
            <button
              onClick={() => handleViewModeChange('list')}
              className={`px-3 py-1 ${viewMode === 'list' ? 'bg-green-600/80' : 'bg-black/60'}`}
              title="Visualização em lista"
              disabled={isLoading}
            >
              <span className="icon">☰</span>
            </button>
          </div>
          
          <select
            className="bg-black/40 border border-green-500/30 rounded px-2 py-1"
            value={sortMode}
            onChange={handleSortChange}
            disabled={isLoading}
          >
            <option value="default">Ordenação padrão</option>
            <option value="name-asc">Nome (A-Z)</option>
            <option value="name-desc">Nome (Z-A)</option>
            <option value="active-first">Ativos primeiro</option>
          </select>
        </div>
      </div>
      
      <div className="provider-filters flex flex-wrap gap-2 mt-2">
        {providers.map(provider => (
          <button
            key={provider.id}
            onClick={() => !isLoading && handleProviderSelect(provider.id)}
            className={`px-3 py-1 rounded-full text-sm ${
              selectedProviders.includes(provider.id)
                ? 'bg-green-600/80 text-white'
                : 'bg-gray-800/80 text-gray-300'
            } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            disabled={isLoading}
          >
            {provider.name} {!isLoading && `(${provider.count})`}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RouletteFilters; 