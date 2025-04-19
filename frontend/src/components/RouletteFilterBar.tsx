import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { 
  filterRoulettesBySearchTerm
} from '@/utils/rouletteFilters';
import { extractProviders } from '@/utils/rouletteProviders';

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  onRefresh?: () => void;
}

/**
 * Componente simplificado que contém apenas a barra de busca e o botão de atualização
 * Todos os filtros estão exclusivamente no SidePanelStats
 */
const RouletteFilterBar: React.FC<RouletteFilterBarProps> = ({
  roulettes,
  onFilter,
  onRefresh
}) => {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [evolutionExpanded, setEvolutionExpanded] = useState(false);
  
  // Extrair provedores das roletas
  const providers = useMemo(() => {
    return extractProviders(roulettes);
  }, [roulettes]);
  
  // Roletas específicas que devem ser exibidas sob o provedor Evolution
  const evolutionSpecificRoulettes = useMemo(() => {
    return [
      "Speed Auto Roulette",
      "XXXtreme Lightning Roulette",
      "Bucharest Auto-Roulette"
    ];
  }, []);
  
  // Efeito para aplicar os filtros quando mudam
  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...roulettes];
      
      // Aplicar filtro de pesquisa
      if (searchTerm.trim()) {
        filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
      }
      
      // Enviar os resultados filtrados
      onFilter(filtered);
    };
    
    applyFilters();
  }, [roulettes, searchTerm, onFilter]);
  
  // Função para atualizar os dados
  const handleRefresh = () => {
    if (onRefresh) {
      setIsRefreshing(true);
      
      // Chamar a função de atualização
      onRefresh();
      
      // Desabilitar o botão por 2 segundos
      setTimeout(() => {
        setIsRefreshing(false);
      }, 2000);
    }
  };
  
  // Número de roletas filtradas
  const filteredCount = roulettes.length;
  
  return (
    <div className="rounded-lg p-4 mb-6 border border-gray-700/50" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
      <div className="flex flex-col gap-4">
        {/* Barra de busca e botão de atualização */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <RouletteSearch
              initialValue={searchTerm}
              onSearch={setSearchTerm}
            />
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10 w-10 text-vegas-gold"
            title="Atualizar roletas"
          >
            <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
        
        {/* Provedores disponíveis */}
        <div className="flex flex-wrap gap-2">
          {providers.map(provider => {
            // Renderização especial para o provedor Evolution
            if (provider.name === 'Evolution') {
              return (
                <div key={provider.id} className="flex flex-col">
                  <div 
                    className="px-3 py-1 rounded-full text-xs border border-green-700 bg-green-900/30 text-green-400 flex items-center gap-1 cursor-pointer"
                    onClick={() => setEvolutionExpanded(!evolutionExpanded)}
                  >
                    {provider.name}
                    {evolutionExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                  
                  {evolutionExpanded && (
                    <div className="ml-4 mt-1 flex flex-col gap-1">
                      {evolutionSpecificRoulettes.map((roulette, index) => (
                        <div 
                          key={index} 
                          className="px-2 py-1 text-xs text-gray-400 border-l border-green-800"
                        >
                          {roulette}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            } else {
              // Renderização normal para os outros provedores
              return (
                <div 
                  key={provider.id} 
                  className="px-2 py-1 rounded-full text-xs border border-gray-700 bg-gray-800 text-gray-300"
                >
                  {provider.name}
                </div>
              );
            }
          })}
        </div>
        
        {/* Contagem de roletas filtradas */}
        <div className="flex justify-end items-center">
          <div className="text-sm text-gray-400">
            Mostrando {filteredCount} roletas
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouletteFilterBar; 