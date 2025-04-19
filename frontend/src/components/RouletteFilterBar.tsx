import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { 
  filterRoulettesBySearchTerm
} from '@/utils/rouletteFilters';
import { extractProviders, filterRoulettesByProvider } from '@/utils/rouletteProviders';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  onRefresh?: () => void;
}

/**
 * Componente simplificado com barra de busca, filtro de provedores e botão de atualização
 * Filtros mais avançados permanecem exclusivamente no SidePanelStats
 */
const RouletteFilterBar: React.FC<RouletteFilterBarProps> = ({
  roulettes,
  onFilter,
  onRefresh
}) => {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  
  // Extrair provedores disponíveis
  const providers = useMemo(() => {
    return extractProviders(roulettes);
  }, [roulettes]);
  
  // Efeito para aplicar os filtros quando mudam
  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...roulettes];
      
      // Aplicar filtro de pesquisa
      if (searchTerm.trim()) {
        filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
      }
      
      // Aplicar filtro de provedores
      if (selectedProviders.length > 0) {
        filtered = filterRoulettesByProvider(filtered, selectedProviders);
      }
      
      // Enviar os resultados filtrados
      onFilter(filtered);
    };
    
    applyFilters();
  }, [roulettes, searchTerm, selectedProviders, onFilter]);
  
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
  
  // Lidar com a seleção/deseleção de provedores
  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev => {
      if (prev.includes(providerId)) {
        return prev.filter(id => id !== providerId);
      } else {
        return [...prev, providerId];
      }
    });
  };
  
  // Limpar todos os filtros de provedores
  const clearProviderFilters = () => {
    setSelectedProviders([]);
  };
  
  // Número de roletas filtradas
  const filteredCount = useMemo(() => {
    let filtered = [...roulettes];
      
    // Aplicar filtro de pesquisa
    if (searchTerm.trim()) {
      filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
    }
    
    // Aplicar filtro de provedores
    if (selectedProviders.length > 0) {
      filtered = filterRoulettesByProvider(filtered, selectedProviders);
    }
    
    return filtered.length;
  }, [roulettes, searchTerm, selectedProviders]);
  
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
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 bg-gray-900 text-gray-200 border-gray-800 px-3"
              >
                Provedores {selectedProviders.length > 0 && `(${selectedProviders.length})`}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-gray-900 border-gray-800 text-gray-200">
              {providers.map(provider => (
                <DropdownMenuCheckboxItem
                  key={provider.id}
                  checked={selectedProviders.includes(provider.id)}
                  onCheckedChange={() => handleProviderToggle(provider.id)}
                  className="focus:bg-gray-800 focus:text-white cursor-pointer"
                >
                  {provider.name}
                </DropdownMenuCheckboxItem>
              ))}
              
              {selectedProviders.length > 0 && (
                <div className="border-t border-gray-800 p-2 mt-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full text-xs text-gray-400 hover:text-white"
                    onClick={clearProviderFilters}
                  >
                    Limpar filtros
                  </Button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
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