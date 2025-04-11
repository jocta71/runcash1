import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import StrategyService, { Strategy, RouletteStrategy } from '@/services/StrategyService';

interface StrategySelectProps {
  roletaId: string;
  roletaNome: string;
  onStrategyChange?: (strategy: Strategy | null) => void;
}

const StrategySelector: React.FC<StrategySelectProps> = ({
  roletaId,
  roletaNome,
  onStrategyChange
}) => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>('');
  const [currentRouletteStrategy, setCurrentRouletteStrategy] = useState<RouletteStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Carregar estratégias e a estratégia atual da roleta
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Carregar todas as estratégias disponíveis
        const availableStrategies = await StrategyService.getStrategies();
        setStrategies(availableStrategies);

        // Removida chamada à API getRouletteStrategy que estava causando erros
        // Definindo diretamente como null
        setCurrentRouletteStrategy(null);
        
        // Selecionar a estratégia do sistema como padrão, se disponível
        const systemStrategy = availableStrategies.find(s => s.isSystem);
        if (systemStrategy) {
          setSelectedStrategyId(systemStrategy._id);
          if (onStrategyChange) {
            onStrategyChange(systemStrategy);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar estratégias:', error);
        toast.error('Não foi possível carregar as estratégias');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [roletaId, onStrategyChange]);

  const handleStrategyChange = (value: string) => {
    setSelectedStrategyId(value);
    const selectedStrategy = strategies.find(s => s._id === value) || null;
    if (onStrategyChange) {
      onStrategyChange(selectedStrategy);
    }
  };

  const handleSaveStrategy = async () => {
    if (!selectedStrategyId) {
      toast.error('Selecione uma estratégia');
      return;
    }

    setSaving(true);
    try {
      const result = await StrategyService.assignStrategy(roletaId, roletaNome, selectedStrategyId);
      if (result) {
        setCurrentRouletteStrategy(result);
        toast.success('Estratégia associada com sucesso');
      } else {
        toast.error('Erro ao associar estratégia');
      }
    } catch (error) {
      console.error('Erro ao salvar estratégia:', error);
      toast.error('Erro ao associar estratégia');
    } finally {
      setSaving(false);
    }
  };

  // Determinar se já existe uma estratégia e se ela é diferente da selecionada
  const isCurrentStrategy = currentRouletteStrategy?.strategyId._id === selectedStrategyId;

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center space-x-2">
        <Select
          value={selectedStrategyId}
          onValueChange={handleStrategyChange}
          disabled={loading || saving}
        >
          <SelectTrigger className="w-full bg-black text-white border-gray-800 hover:bg-gray-900 focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder={loading ? 'Carregando estratégias...' : 'Selecione uma estratégia'} />
          </SelectTrigger>
          <SelectContent className="bg-black text-white border-gray-800 z-[1000]" position="popper" sideOffset={5}>
            {strategies.map((strategy) => (
              <SelectItem key={strategy._id} value={strategy._id} className="hover:bg-gray-800 focus:bg-gray-800">
                <div className="flex items-center">
                  {strategy.name}
                  {strategy.isSystem && <span className="ml-2 text-xs text-blue-500">(Sistema)</span>}
                  {strategy.isPublic && <span className="ml-2 text-xs text-green-500">(Pública)</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isCurrentStrategy ? (
          <Button 
            variant="outline" 
            size="icon" 
            className="shrink-0 text-green-500 bg-black border-gray-800" 
            disabled={true}
          >
            <Check className="h-4 w-4" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="icon" 
            className="shrink-0 bg-black text-white border-gray-800 hover:bg-gray-900" 
            onClick={handleSaveStrategy}
            disabled={loading || saving || !selectedStrategyId}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
          </Button>
        )}
      </div>
      
      <div className="text-xs text-muted-foreground">
        {currentRouletteStrategy ? (
          <span className="text-green-500">
            Estratégia atual: {currentRouletteStrategy.strategyId.name}
          </span>
        ) : (
          <span>Nenhuma estratégia configurada para esta roleta</span>
        )}
      </div>
    </div>
  );
};

export default StrategySelector; 