import React from 'react';
import { Filter } from 'lucide-react';

export interface RouletteProvider {
  id: string;
  name: string;
}

interface RouletteFiltersProps {
  providers: RouletteProvider[];
  selectedProviders: string[];
  onProviderSelect: (providerId: string) => void;
  onClearFilters: () => void;
  onNumberFilterChange?: (number: number | null) => void;
  onColorFilterChange?: (color: 'red' | 'black' | 'green' | null) => void;
  onParityFilterChange?: (parity: 'even' | 'odd' | null) => void;
  onTimeFilterChange?: (minutes: number | null) => void;
  onOpenSidePanelStats?: () => void;
}

/**
 * Componente simplificado que serve como intermediário para abrir o SidePanelStats
 * Todos os filtros de roleta foram movidos para o SidePanelStats
 */
const RouletteFilters: React.FC<RouletteFiltersProps> = ({
  providers,
  selectedProviders,
  onOpenSidePanelStats
}) => {
  // Se não existirem provedores, não renderiza o componente
  if (!providers || providers.length === 0) {
    return null;
  }

  const handleFilterClick = () => {
    // Chamar função para abrir o SidePanelStats quando disponível
    if (onOpenSidePanelStats) {
      onOpenSidePanelStats();
    }
  };

  return (
    <div className="space-y-4">
      {/* Botão para abrir o SidePanelStats */}
      <div className="flex items-center justify-between cursor-pointer" onClick={handleFilterClick}>
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-vegas-gold" />
          <h3 className="text-sm font-medium text-white">Filtros de roleta</h3>
        </div>
        <div className="text-xs text-gray-400">
          Clique para abrir os filtros avançados
        </div>
      </div>
      
      {/* Informação de filtros ativos */}
      {selectedProviders.length > 0 && (
        <div className="bg-card p-2 rounded-md">
          <p className="text-xs text-gray-300">
            Filtros ativos: {selectedProviders.length} provedor(es)
          </p>
        </div>
      )}
    </div>
  );
};

export default RouletteFilters; 