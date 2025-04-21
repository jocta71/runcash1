import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AnalyticsFilterRow from './AnalyticsFilterRow';

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

  // Handlers para os filtros de dropdown
  const handleColorFilterChange = (color: string) => {
    if (color === 'todas') {
      onColorFilterChange([]);
    } else {
      const colorValues = color.split('+');
      onColorFilterChange(colorValues);
    }
  };

  const handleNumberFilterChange = (number: string) => {
    if (number === 'todos') {
      onNumberFilterChange([]);
    } else {
      const numberValue = parseInt(number, 10);
      onNumberFilterChange(!isNaN(numberValue) ? [numberValue] : []);
    }
  };

  const handleHourFilterChange = (hour: string) => {
    onHourFilterChange(hour === 'todas' ? [] : [hour]);
  };

  const handleMinuteFilterChange = (minute: string) => {
    onMinuteFilterChange(minute === 'todos' ? [] : [minute]);
  };

  const handleLastMinuteFilterChange = (value: string) => {
    onLastMinuteFilterChange(value === 'ativado');
  };

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
  }, [
    quantity, startDate, endDate, startTime, endTime,
    onQuantityChange, onStartDateChange, onEndDateChange, onStartTimeChange, onEndTimeChange
  ]);
  
  // Limpar todos os filtros
  const handleClearFilters = () => {
    setQuantity('200');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
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
            className="h-9 bg-[#111] border-gray-700 text-white"
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
            className="h-9 bg-[#111] border-gray-700 text-white"
          />
        </div>
        
        {/* Data final */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Data final</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-9 bg-[#111] border-gray-700 text-white"
          />
        </div>
        
        {/* Hora inicial */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Hora inicial</label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="h-9 bg-[#111] border-gray-700 text-white"
          />
        </div>
        
        {/* Hora final */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Hora final</label>
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="h-9 bg-[#111] border-gray-700 text-white"
          />
        </div>
        
        {/* Coluna vazia para alinhamento */}
        <div className="col-span-2"></div>
      </div>
      
      {/* Segunda linha: Filtros de dropdown em linha */}
      <AnalyticsFilterRow 
        onColorFilterChange={handleColorFilterChange}
        onNumberFilterChange={handleNumberFilterChange}
        onHourFilterChange={handleHourFilterChange}
        onMinuteFilterChange={handleMinuteFilterChange}
        onLastMinuteFilterChange={handleLastMinuteFilterChange}
      />
      
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