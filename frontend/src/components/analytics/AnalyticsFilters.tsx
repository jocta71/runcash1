import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface AnalyticsFiltersProps {
  onQuantityChange: (quantity: number) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
  onColorFilterChange: (colors: string[]) => void;
  onNumberFilterChange: (numbers: number[]) => void;
  onHourFilterChange: (hours: string[]) => void;
  onMinuteFilterChange: (minutes: string[]) => void;
  onLastMinuteFilterChange: (lastMinuteEnabled: boolean) => void;
  onFilterApply: () => void;
  onFilterClear: () => void;
  onHighlight: () => void;
}

/**
 * Componente de filtros específicos para análise de roletas
 */
const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  onQuantityChange,
  onStartDateChange,
  onEndDateChange,
  onStartTimeChange,
  onEndTimeChange,
  onColorFilterChange,
  onNumberFilterChange,
  onHourFilterChange,
  onMinuteFilterChange,
  onLastMinuteFilterChange,
  onFilterApply,
  onFilterClear,
  onHighlight
}) => {
  // Estados dos filtros
  const [quantity, setQuantity] = useState<string>('200');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  
  // Opções para filtros
  const colorOptions = ['Todas', 'Vermelhas', 'Pretas', 'Verdes'];
  const numberOptions = ['Todos']; // Poderia expandir para números específicos
  const hourOptions = ['Todas']; // Poderia expandir para horas específicas
  const minuteOptions = ['Todos']; // Poderia expandir para minutos específicos
  
  // Estados de seleção para os selects
  const [selectedColors, setSelectedColors] = useState<string[]>(['Todas']);
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>(['Todos']);
  const [selectedHours, setSelectedHours] = useState<string[]>(['Todas']);
  const [selectedMinutes, setSelectedMinutes] = useState<string[]>(['Todos']);
  const [lastMinuteEnabled, setLastMinuteEnabled] = useState<boolean>(false);
  
  // Efeito para notificar mudanças
  useEffect(() => {
    // Converter quantity para número
    const quantityNum = parseInt(quantity, 10);
    if (!isNaN(quantityNum)) {
      onQuantityChange(quantityNum);
    }
    
    // Notificar outras mudanças
    onStartDateChange(startDate);
    onEndDateChange(endDate);
    onStartTimeChange(startTime);
    onEndTimeChange(endTime);
    
    // Converter seleções para o formato esperado pelos callbacks
    if (selectedColors.includes('Todas')) {
      onColorFilterChange([]);
    } else {
      onColorFilterChange(selectedColors);
    }
    
    if (selectedNumbers.includes('Todos')) {
      onNumberFilterChange([]);
    } else {
      const numberValues = selectedNumbers
        .filter(n => n !== 'Todos')
        .map(n => parseInt(n, 10))
        .filter(n => !isNaN(n));
      onNumberFilterChange(numberValues);
    }
    
    onHourFilterChange(selectedHours.includes('Todas') ? [] : selectedHours);
    onMinuteFilterChange(selectedMinutes.includes('Todas') ? [] : selectedMinutes);
    onLastMinuteFilterChange(lastMinuteEnabled);
    
  }, [
    quantity, startDate, endDate, startTime, endTime,
    selectedColors, selectedNumbers, selectedHours, selectedMinutes, lastMinuteEnabled,
    onQuantityChange, onStartDateChange, onEndDateChange, onStartTimeChange, onEndTimeChange,
    onColorFilterChange, onNumberFilterChange, onHourFilterChange, onMinuteFilterChange, onLastMinuteFilterChange
  ]);
  
  // Handler para mudar a seleção de um select
  const handleSelectChange = (
    currentValue: string,
    currentSelection: string[],
    setSelection: React.Dispatch<React.SetStateAction<string[]>>,
    options: string[]
  ) => {
    // Se selecionou "Todas", limpa as outras seleções
    if (currentValue === 'Todas') {
      setSelection(['Todas']);
      return;
    }
    
    // Se já tinha "Todas" selecionado, remove-o
    let newSelection = currentSelection.filter(item => item !== 'Todas');
    
    // Toggles the selection
    if (newSelection.includes(currentValue)) {
      newSelection = newSelection.filter(item => item !== currentValue);
      
      // Se ficou vazio, seleciona "Todas"
      if (newSelection.length === 0) {
        newSelection = ['Todas'];
      }
    } else {
      newSelection.push(currentValue);
    }
    
    setSelection(newSelection);
  };
  
  // Limpar todos os filtros
  const handleClearFilters = () => {
    setQuantity('200');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setSelectedColors(['Todas']);
    setSelectedNumbers(['Todos']);
    setSelectedHours(['Todas']);
    setSelectedMinutes(['Todos']);
    setLastMinuteEnabled(false);
    
    onFilterClear();
  };
  
  return (
    <div className="space-y-4 p-4 rounded-lg border border-gray-700/50" style={{ backgroundColor: 'rgb(19 22 20 / var(--tw-bg-opacity, 1))' }}>
      {/* Primeira linha: Quantidade, datas e horários */}
      <div className="grid grid-cols-12 gap-4">
        {/* Quantidade */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Quantidade</label>
          <Input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-9 bg-gray-800/50 border-gray-700 text-white"
            placeholder="200"
          />
        </div>
        
        {/* Data inicial */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Data inicial</label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-9 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>
        
        {/* Data final */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Data final</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>
        
        {/* Hora inicial */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Hora inicial</label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-9 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>
        
        {/* Hora final */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Hora final</label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-9 bg-gray-800/50 border-gray-700 text-white"
          />
        </div>
        
        {/* Coluna vazia para alinhamento */}
        <div className="col-span-2"></div>
      </div>
      
      {/* Segunda linha: Filtros de cores, números, horas e minutos */}
      <div className="grid grid-cols-12 gap-4">
        {/* Filtro por cores */}
        <div className="col-span-3">
          <label className="block text-sm text-gray-400 mb-1">Por cores</label>
          <div className="flex flex-wrap gap-2">
            {colorOptions.map(color => (
              <Button
                key={color}
                size="sm"
                variant={selectedColors.includes(color) ? "default" : "outline"}
                className={`h-8 ${
                  selectedColors.includes(color) 
                    ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" 
                    : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
                }`}
                onClick={() => handleSelectChange(
                  color, 
                  selectedColors, 
                  setSelectedColors, 
                  colorOptions
                )}
              >
                {color}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Filtro por número */}
        <div className="col-span-3">
          <label className="block text-sm text-gray-400 mb-1">Por número</label>
          <div className="flex flex-wrap gap-2">
            {numberOptions.map(number => (
              <Button
                key={number}
                size="sm"
                variant={selectedNumbers.includes(number) ? "default" : "outline"}
                className={`h-8 ${
                  selectedNumbers.includes(number) 
                    ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" 
                    : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
                }`}
                onClick={() => handleSelectChange(
                  number, 
                  selectedNumbers, 
                  setSelectedNumbers, 
                  numberOptions
                )}
              >
                {number}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Filtro por hora */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Por hora</label>
          <div className="flex flex-wrap gap-2">
            {hourOptions.map(hour => (
              <Button
                key={hour}
                size="sm"
                variant={selectedHours.includes(hour) ? "default" : "outline"}
                className={`h-8 ${
                  selectedHours.includes(hour) 
                    ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" 
                    : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
                }`}
                onClick={() => handleSelectChange(
                  hour, 
                  selectedHours, 
                  setSelectedHours, 
                  hourOptions
                )}
              >
                {hour}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Filtro por minuto */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Por minuto</label>
          <div className="flex flex-wrap gap-2">
            {minuteOptions.map(minute => (
              <Button
                key={minute}
                size="sm"
                variant={selectedMinutes.includes(minute) ? "default" : "outline"}
                className={`h-8 ${
                  selectedMinutes.includes(minute) 
                    ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" 
                    : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
                }`}
                onClick={() => handleSelectChange(
                  minute, 
                  selectedMinutes, 
                  setSelectedMinutes, 
                  minuteOptions
                )}
              >
                {minute}
              </Button>
            ))}
          </div>
        </div>
        
        {/* Filtro pelo último minuto */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Pelo último minuto</label>
          <Button
            size="sm"
            variant={lastMinuteEnabled ? "default" : "outline"}
            className={`h-8 ${
              lastMinuteEnabled 
                ? "bg-vegas-gold text-black hover:bg-vegas-gold/90" 
                : "text-vegas-gold hover:bg-vegas-gold/10 border-vegas-gold/30"
            }`}
            onClick={() => setLastMinuteEnabled(!lastMinuteEnabled)}
          >
            {lastMinuteEnabled ? 'Ativado' : 'Todos'}
          </Button>
        </div>
      </div>
      
      {/* Terceira linha: Botões de ação */}
      <div className="flex justify-between pt-2 mt-4 border-t border-gray-700/30">
        <div className="flex gap-2">
          <Button 
            onClick={onFilterApply}
            className="bg-blue-600 hover:bg-blue-700 text-white h-9 px-4"
          >
            <Filter size={16} className="mr-2" /> FILTRAR
          </Button>
          
          <Button 
            onClick={onHighlight}
            variant="outline" 
            className="border-gray-700 text-vegas-gold hover:bg-gray-800 h-9 px-4"
          >
            DESTACAR
          </Button>
          
          <Button 
            onClick={handleClearFilters}
            variant="outline" 
            className="border-gray-700 text-gray-400 hover:bg-gray-800 h-9 px-4"
          >
            LIMPAR
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsFilters; 