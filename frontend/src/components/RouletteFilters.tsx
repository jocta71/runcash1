import React from 'react';
import { Check, Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface RouletteProvider {
  id: string;
  name: string;
}

interface RouletteFiltersProps {
  providers: RouletteProvider[];
  selectedProviders: string[];
  onProviderSelect: (providerId: string) => void;
  onClearFilters: () => void;
}

/**
 * Componente para filtrar roletas por provedor
 */
const RouletteFilters: React.FC<RouletteFiltersProps> = ({
  providers,
  selectedProviders,
  onProviderSelect,
  onClearFilters
}) => {
  // Se não existirem provedores, não renderiza o componente
  if (!providers || providers.length === 0) {
    return null;
  }

  const hasFilters = selectedProviders.length > 0;

  return (
    <div className="mb-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-vegas-gold" />
          <h3 className="text-sm font-medium text-white">Filtrar por provedor</h3>
        </div>
        
        {hasFilters && (
          <Button 
            onClick={onClearFilters}
            variant="ghost" 
            size="sm"
            className="h-7 px-2 text-xs text-gray-400 hover:text-white"
          >
            <X size={14} className="mr-1" />
            Limpar filtros
          </Button>
        )}
      </div>
      
      <div className="flex flex-wrap gap-2">
        {providers.map(provider => {
          const isSelected = selectedProviders.includes(provider.id);
          
          return (
            <Button
              key={provider.id}
              onClick={() => onProviderSelect(provider.id)}
              size="sm"
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "h-8 rounded-full",
                isSelected ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" : "text-vegas-gold hover:bg-vegas-gold/10"
              )}
            >
              {isSelected && <Check size={14} className="mr-1" />}
              {provider.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
};

export default RouletteFilters; 