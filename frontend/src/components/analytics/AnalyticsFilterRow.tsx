import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AnalyticsFilterRowProps {
  onColorFilterChange: (color: string) => void;
  onNumberFilterChange: (number: string) => void;
  onHourFilterChange: (hour: string) => void;
  onMinuteFilterChange: (minute: string) => void;
  onLastMinuteFilterChange: (value: string) => void;
}

/**
 * Componente que renderiza uma linha de filtros com dropdowns
 */
const AnalyticsFilterRow: React.FC<AnalyticsFilterRowProps> = ({
  onColorFilterChange,
  onNumberFilterChange,
  onHourFilterChange,
  onMinuteFilterChange,
  onLastMinuteFilterChange
}) => {
  // Opções para os filtros
  const colorOptions = [
    { value: 'todas', label: 'Todas' },
    { value: 'vermelhos', label: 'Vermelhos', color: 'bg-red-600' },
    { value: 'pretos', label: 'Pretos', color: 'bg-gray-900' },
    { value: 'brancos', label: 'Brancos', color: 'bg-white' },
    { value: 'pretos+vermelhos', label: 'Pretos + Vermelhos', combined: ['bg-gray-900', 'bg-red-600'] },
    { value: 'brancos+pretos', label: 'Brancos + Pretos', combined: ['bg-white', 'bg-gray-900'] },
    { value: 'brancos+vermelhos', label: 'Brancos + Vermelhos', combined: ['bg-white', 'bg-red-600'] }
  ];

  // Gerar as opções de números de 0 a 36
  const numberOptions = [
    { value: 'todos', label: 'Todos' },
    { value: '0', label: '0' },
    ...Array.from({ length: 36 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1)
    }))
  ];

  const hourOptions = [
    { value: 'todas', label: 'Todas' }
    // Você poderia adicionar opções de horas aqui
  ];

  const minuteOptions = [
    { value: 'todos', label: 'Todos' },
    ...Array.from({ length: 60 }, (_, i) => ({
      value: i.toString().padStart(2, '0'),
      label: i.toString().padStart(2, '0')
    }))
  ];

  const lastMinuteOptions = [
    { value: 'todos', label: 'Todos' },
    { value: 'ativado', label: 'Ativado' }
  ];

  return (
    <div className="flex w-full space-x-2 bg-[#17191a] p-1">
      {/* Filtro por cor */}
      <div className="flex-1">
        <div className="text-xs text-gray-400 mb-1 px-2">Por cores</div>
        <Select defaultValue="todas" onValueChange={onColorFilterChange}>
          <SelectTrigger className="w-full bg-black border-none text-white h-10">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-gray-800 text-white">
            {colorOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                <div className="flex items-center">
                  {option.combined ? (
                    <div className="flex mr-2">
                      <span className={`w-2 h-2 rounded-full ${option.combined[0]} mr-0.5`}></span>
                      <span className={`w-2 h-2 rounded-full ${option.combined[1]}`}></span>
                    </div>
                  ) : option.color ? (
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
      <div className="flex-1">
        <div className="text-xs text-gray-400 mb-1 px-2">Por número</div>
        <Select defaultValue="todos" onValueChange={onNumberFilterChange}>
          <SelectTrigger className="w-full bg-black border-none text-white h-10">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-gray-800 text-white max-h-[200px] overflow-y-auto">
            {numberOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro por hora */}
      <div className="flex-1">
        <div className="text-xs text-gray-400 mb-1 px-2">Por hora</div>
        <Select defaultValue="todas" onValueChange={onHourFilterChange}>
          <SelectTrigger className="w-full bg-black border-none text-white h-10">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-gray-800 text-white">
            {hourOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro por minuto */}
      <div className="flex-1">
        <div className="text-xs text-gray-400 mb-1 px-2">Por minuto</div>
        <Select defaultValue="todos" onValueChange={onMinuteFilterChange}>
          <SelectTrigger className="w-full bg-black border-none text-white h-10">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-gray-800 text-white max-h-[200px] overflow-y-auto">
            {minuteOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Filtro pelo último minuto */}
      <div className="flex-1">
        <div className="text-xs text-gray-400 mb-1 px-2">Pelo último minuto</div>
        <Select defaultValue="todos" onValueChange={onLastMinuteFilterChange}>
          <SelectTrigger className="w-full bg-black border-none text-white h-10">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent className="bg-[#111] border-gray-800 text-white">
            {lastMinuteOptions.map(option => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default AnalyticsFilterRow; 