import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Filter, Hash, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  const [selectedColorOption, setSelectedColorOption] = useState<string>('todas');
  const [selectedNumberOption, setSelectedNumberOption] = useState<string>('todos');
  const [selectedHourOption, setSelectedHourOption] = useState<string>('todas');
  const [selectedMinuteOption, setSelectedMinuteOption] = useState<string>('todos');
  const [lastMinuteEnabled, setLastMinuteEnabled] = useState<boolean>(false);
  
  // Opções para os filtros
  const colorOptions = [
    { value: 'todas', label: 'Todas' },
    { value: 'vermelhas', label: 'Vermelhas', color: 'bg-red-600' },
    { value: 'pretas', label: 'Pretas', color: 'bg-black' },
    { value: 'verdes', label: 'Zero', color: 'bg-green-600' },
    { value: 'pretas+vermelhas', label: 'Pretas + Vermelhas', combined: ['bg-black', 'bg-red-600'] },
    { value: 'pretas+verdes', label: 'Pretas + Zero', combined: ['bg-black', 'bg-green-600'] },
    { value: 'vermelhas+verdes', label: 'Vermelhas + Zero', combined: ['bg-red-600', 'bg-green-600'] }
  ];
  
  const numberOptions = [
    { value: 'todos', label: 'Todos' },
    // Você pode adicionar números específicos aqui se necessário
  ];
  
  const hourOptions = [
    { value: 'todas', label: 'Todas' },
    // Você pode adicionar horas específicas aqui se necessário
  ];
  
  const minuteOptions = [
    { value: 'todos', label: 'Todos' },
    // Você pode adicionar minutos específicos aqui se necessário
  ];
  
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
    if (selectedColorOption === 'todas') {
      onColorFilterChange([]);
    } else {
      const colorValues = selectedColorOption.split('+');
      onColorFilterChange(colorValues);
    }
    
    if (selectedNumberOption === 'todos') {
      onNumberFilterChange([]);
    } else {
      // Converte o número selecionado para um array com esse número
      const numberValue = parseInt(selectedNumberOption, 10);
      onNumberFilterChange(!isNaN(numberValue) ? [numberValue] : []);
    }
    
    onHourFilterChange(selectedHourOption === 'todas' ? [] : [selectedHourOption]);
    onMinuteFilterChange(selectedMinuteOption === 'todos' ? [] : [selectedMinuteOption]);
    onLastMinuteFilterChange(lastMinuteEnabled);
    
  }, [
    quantity, startDate, endDate, startTime, endTime,
    selectedColorOption, selectedNumberOption, selectedHourOption, selectedMinuteOption, lastMinuteEnabled,
    onQuantityChange, onStartDateChange, onEndDateChange, onStartTimeChange, onEndTimeChange,
    onColorFilterChange, onNumberFilterChange, onHourFilterChange, onMinuteFilterChange, onLastMinuteFilterChange
  ]);
  
  // Limpar todos os filtros
  const handleClearFilters = () => {
    setQuantity('200');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setSelectedColorOption('todas');
    setSelectedNumberOption('todos');
    setSelectedHourOption('todas');
    setSelectedMinuteOption('todos');
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
      
      {/* Segunda linha: Filtros de cores, números, horas e minutos */}
      <div className="grid grid-cols-12 gap-4">
        {/* Filtro por cores */}
        <div className="col-span-3">
          <label className="block text-sm text-gray-400 mb-1">Por cores</label>
          <Select value={selectedColorOption} onValueChange={setSelectedColorOption}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              {colorOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center">
                    {option.combined ? (
                      // Para opções combinadas, mostrar dois círculos
                      <div className="flex mr-2">
                        <span className={`w-2 h-2 rounded-full ${option.combined[0]} mr-1`}></span>
                        <span className={`w-2 h-2 rounded-full ${option.combined[1]}`}></span>
                      </div>
                    ) : option.color ? (
                      // Para opções com uma única cor
                      <span className={`mr-2 w-2 h-2 rounded-full ${option.color}`}></span>
                    ) : null}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por número */}
        <div className="col-span-3">
          <label className="block text-sm text-gray-400 mb-1">Por número</label>
          <Select value={selectedNumberOption} onValueChange={setSelectedNumberOption}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              {numberOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por hora */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Por hora</label>
          <Select value={selectedHourOption} onValueChange={setSelectedHourOption}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              {hourOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro por minuto */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Por minuto</label>
          <Select value={selectedMinuteOption} onValueChange={setSelectedMinuteOption}>
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              {minuteOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Filtro pelo último minuto */}
        <div className="col-span-2">
          <label className="block text-sm text-gray-400 mb-1">Pelo último minuto</label>
          <Select
            value={lastMinuteEnabled ? "ativado" : "todos"}
            onValueChange={(value) => setLastMinuteEnabled(value === "ativado")}
          >
            <SelectTrigger className="w-full bg-[#111] border-gray-700 text-white h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent className="bg-[#111] border-gray-700 text-white">
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="ativado">Ativado</SelectItem>
            </SelectContent>
          </Select>
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