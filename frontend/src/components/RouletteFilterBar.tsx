import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RouletteProvider } from '@/components/RouletteFilters';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { extractProviders } from '@/utils/rouletteProviders';
import { 
  filterRoulettesBySearchTerm
} from '@/utils/rouletteFilters';

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  onRefresh?: () => void;
  onOpenSidePanelStats?: () => void;
}

/**
 * Componente que combina filtros para roletas
 * Os filtros avançados foram movidos para o SidePanel
 */
const RouletteFilterBar: React.FC<RouletteFilterBarProps> = ({
  roulettes,
  onFilter,
  onRefresh,
  onOpenSidePanelStats
}) => {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Extrair provedores das roletas
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
  
  // Função para abrir o painel lateral de filtros
  const handleOpenFilterPanel = () => {
    if (onOpenSidePanelStats) {
      onOpenSidePanelStats();
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
        
        {/* Botão para abrir o painel lateral de filtros */}
        <div className="flex justify-between items-center">
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenFilterPanel}
              className="text-vegas-gold"
            >
              Filtros avançados
            </Button>
          </div>
          <div className="text-sm text-gray-400">
            Mostrando {filteredCount} roletas
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouletteFilterBar; 