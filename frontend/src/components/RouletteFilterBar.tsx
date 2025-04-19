import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import RouletteSearch from '@/components/RouletteSearch';
import { RouletteData } from '@/types';
import { 
  filterRoulettesBySearchTerm
} from '@/utils/rouletteFilters';
import { extractProviders, identifyProvider } from '@/utils/rouletteProviders';

interface RouletteFilterBarProps {
  roulettes: RouletteData[];
  onFilter: (filtered: RouletteData[]) => void;
  onRefresh?: () => void;
}

/**
 * Componente simplificado que contém barra de busca, botão de atualização e filtros rápidos de provedor
 */
const RouletteFilterBar: React.FC<RouletteFilterBarProps> = ({
  roulettes,
  onFilter,
  onRefresh
}) => {
  // Estados para os filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [providerExpanded, setProviderExpanded] = useState<boolean>(false);
  
  // Extrair provedores das roletas
  const providers = useMemo(() => {
    return extractProviders(roulettes);
  }, [roulettes]);
  
  // Agrupar roletas por provedor
  const roulettesByProvider = useMemo(() => {
    const groups: Record<string, RouletteData[]> = {};
    
    // Inicializar grupos vazios para cada provedor
    providers.forEach(provider => {
      groups[provider.name] = [];
    });
    
    // Classificar cada roleta no grupo do seu provedor
    roulettes.forEach(roulette => {
      const name = roulette.name || roulette.nome || '';
      const provider = identifyProvider(name);
      
      if (provider && groups[provider]) {
        groups[provider].push(roulette);
      }
    });
    
    return groups;
  }, [roulettes, providers]);
  
  // Efeito para aplicar os filtros quando mudam
  useEffect(() => {
    const applyFilters = () => {
      let filtered = [...roulettes];
      
      // Aplicar filtro de pesquisa
      if (searchTerm.trim()) {
        filtered = filterRoulettesBySearchTerm(filtered, searchTerm);
      }
      
      // Aplicar filtro de provedor
      if (selectedProvider) {
        filtered = filtered.filter(roulette => {
          const name = roulette.name || roulette.nome || '';
          const provider = identifyProvider(name);
          return provider === selectedProvider;
        });
      }
      
      // Enviar os resultados filtrados
      onFilter(filtered);
    };
    
    applyFilters();
  }, [roulettes, searchTerm, selectedProvider, onFilter]);
  
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

  // Função para selecionar/desselecionar um provedor
  const handleProviderClick = (providerName: string) => {
    // Se clicar no mesmo provedor que já está selecionado
    if (providerName === selectedProvider) {
      // Alterna o estado expandido
      setProviderExpanded(!providerExpanded);
    } else {
      // Seleciona o novo provedor e o expande
      setSelectedProvider(providerName);
      setProviderExpanded(true);
    }
  };

  // Função para limpar todos os filtros
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedProvider(null);
    setProviderExpanded(false);
  };
  
  // Número de roletas filtradas
  const filteredCount = useMemo(() => {
    let count = roulettes.length;
    
    if (selectedProvider) {
      count = roulettes.filter(roulette => {
        const name = roulette.name || roulette.nome || '';
        const provider = identifyProvider(name);
        return provider === selectedProvider;
      }).length;
    }
    
    return count;
  }, [roulettes, selectedProvider]);
  
  // Verificar se há filtros ativos
  const hasActiveFilters = selectedProvider !== null || searchTerm !== '';
  
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
        
        {/* Filtros e botão para limpar */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400">Provedores:</div>
          {hasActiveFilters && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-6 px-2 text-xs text-gray-400 hover:text-white flex items-center gap-1"
              onClick={clearFilters}
            >
              <X size={12} /> Limpar filtros
            </Button>
          )}
        </div>
        
        {/* Provedores disponíveis (agora como filtros) */}
        <div className="flex flex-wrap gap-2">
          {providers.map(provider => {
            const isSelected = selectedProvider === provider.name;
            
            return (
              <div key={provider.id} className="flex flex-col">
                <div 
                  className={`px-2 py-1 rounded-full text-xs border transition-colors cursor-pointer flex items-center gap-1 ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-500/20 text-blue-400' 
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                  onClick={() => handleProviderClick(provider.name)}
                >
                  {provider.name}
                  {isSelected && (
                    providerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                  )}
                </div>
                
                {/* Lista de roletas do provedor quando expandido */}
                {isSelected && providerExpanded && roulettesByProvider[provider.name]?.length > 0 && (
                  <div className="ml-4 mt-1 flex flex-col gap-1 max-h-40 overflow-y-auto">
                    {roulettesByProvider[provider.name].map((roulette, index) => (
                      <div 
                        key={index} 
                        className="px-2 py-1 text-xs text-gray-400 border-l border-blue-800"
                        title={roulette.name || roulette.nome || ''}
                      >
                        {(roulette.name || roulette.nome || '').length > 30 
                          ? (roulette.name || roulette.nome || '').substring(0, 30) + '...' 
                          : (roulette.name || roulette.nome || '')}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
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