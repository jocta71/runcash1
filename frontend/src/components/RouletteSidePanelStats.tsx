import { ChartBar, BarChart, ChevronDown, Filter, X, PlusCircle, Trash2, Settings2, AlertCircle, CheckCircle, BrainCircuit, TrendingUp, Clock, Flame, AlertTriangle, Grid3X3 } from "lucide-react";
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { getLogger } from '../services/utils/logger';
import { uniqueId } from 'lodash';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import NumberDisplay from './NumberDisplay';
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import axios from 'axios';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { v4 as uuidv4 } from 'uuid';

// Criando um logger específico para este componente
const logger = getLogger('RouletteSidePanelStats');

interface RouletteSidePanelStatsProps {
  roletaId: string;
  roletaNome: string;
  lastNumbers: number[];
  wins: number;
  losses: number;
  providers?: RouletteProvider[];
}

export interface RouletteProvider {
  id: string;
  name: string;
}

// Modificar a interface para incluir timestamp
interface RouletteNumber {
  numero: number;
  timestamp: string;
}

// Tipo para filtros de cor
type ColorFilter = 'todos' | 'vermelho' | 'preto' | 'verde';

// Novo estado para controlar número selecionado
type SelectedNumberState = number | null;

// Ordem dos números em uma roleta de cassino europeia
const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Mapear regiões da roleta
const ROULETTE_REGIONS = [
  { name: "Região 1 (0-9)", numbers: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { name: "Região 2 (10-19)", numbers: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
  { name: "Região 3 (20-29)", numbers: [20, 21, 22, 23, 24, 25, 26, 27, 28, 29] },
  { name: "Região 4 (30-36)", numbers: [30, 31, 32, 33, 34, 35, 36] },
];

// Função para gerar números aleatórios para testes (apenas como último recurso)
const generateFallbackNumbers = (count: number = 20): number[] => {
  // Uso do console em vez de logger para evitar erro de redefinição
  console.warn(`Não serão gerados números aleatórios`);
  return []; // Retornar array vazio em vez de números aleatórios
};

// Generate frequency data for numbers
export const generateFrequencyData = (numbers: number[]) => {
  const frequency: Record<number, number> = {};
  
  // Initialize all roulette numbers (0-36)
  for (let i = 0; i <= 36; i++) {
    frequency[i] = 0;
  }
  
  // Count frequency of each number
  numbers.forEach(num => {
    if (frequency[num] !== undefined) {
      frequency[num]++;
    }
  });
  
  // Convert to array format needed for charts
  return Object.keys(frequency).map(key => ({
    number: parseInt(key),
    frequency: frequency[parseInt(key)]
  })).sort((a, b) => a.number - b.number);
};

// Calculate hot and cold numbers
export const getHotColdNumbers = (frequencyData: {number: number, frequency: number}[]) => {
  const sorted = [...frequencyData].sort((a, b) => b.frequency - a.frequency);
  return {
    hot: sorted.slice(0, 5),  // 5 most frequent
    cold: sorted.slice(-5).reverse()  // 5 least frequent
  };
};

// Tema comum para os gráficos Recharts - Estilo Shadcn
const chartTheme = {
  backgroundColor: 'hsl(224 71% 4%)',
  textColor: 'hsl(213 31% 91%)',
  fontSize: 14,
  // Cores do tema shadcn/ui
  colors: {
    primary: 'hsl(142.1 70.6% 45.3%)',
    muted: 'hsl(215.4 16.3% 56.9%)',
    background: 'hsl(224 71% 4%)',
    foreground: 'hsl(213 31% 91%)',
    accent: 'hsl(210 40% 96.1%)',
    red: 'hsl(0 72.2% 50.6%)',
    green: 'hsl(142.1 70.6% 45.3%)',
    blue: 'hsl(217.2 91.2% 59.8%)',
    destructive: 'hsl(0 62.8% 30.6%)',
    border: 'hsl(216 34% 17%)',
    card: 'hsl(224 71% 4%)',
    cardForeground: 'hsl(213 31% 91%)',
  }
};

// Generate pie chart data for number groups
export const generateGroupDistribution = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const groups = [
    { name: "Vermelhos", value: 0, color: "hsl(0 72.2% 50.6%)" },
    { name: "Pretos", value: 0, color: "hsl(220 14% 20%)" },
    { name: "Zero", value: 0, color: "hsl(142.1 70.6% 45.3%)" },
  ];
  
  numbers.forEach(num => {
    if (num === 0) {
      groups[2].value += 1;
    } else if (redNumbers.includes(num)) {
      groups[0].value += 1;
    } else {
      groups[1].value += 1;
    }
  });
  
  // Garantir que grupos vazios tenham pelo menos valor 1 para exibição
  groups.forEach(group => {
    if (group.value === 0) group.value = 1;
  });
  
  return groups;
};

// Gerar dados de média de cores por hora
export const generateColorHourlyStats = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const total = numbers.length || 1; // Evitar divisão por zero
  
  // Contar números por cor
  const redCount = numbers.filter(num => redNumbers.includes(num)).length;
  const blackCount = numbers.filter(num => num !== 0 && !redNumbers.includes(num)).length;
  const zeroCount = numbers.filter(num => num === 0).length;
  
  // Calcular média por hora (assumindo que temos dados de uma hora)
  const redAverage = parseFloat((redCount / (total / 60)).toFixed(2));
  const blackAverage = parseFloat((blackCount / (total / 60)).toFixed(2));
  const zeroAverage = parseFloat((zeroCount / (total / 60)).toFixed(2));
  
  return [
    {
      name: "Vermelhos",
      value: redAverage,
      color: "hsl(0 72.2% 50.6%)",
      total: redCount,
      percentage: parseFloat(((redCount / total) * 100).toFixed(1))
    },
    {
      name: "Pretos",
      value: blackAverage,
      color: "hsl(220 14% 20%)",
      total: blackCount,
      percentage: parseFloat(((blackCount / total) * 100).toFixed(1))
    },
    {
      name: "Zero",
      value: zeroAverage,
      color: "hsl(142.1 70.6% 45.3%)",
      total: zeroCount,
      percentage: parseFloat(((zeroCount / total) * 100).toFixed(1))
    }
  ];
};

// Função para gerar dados de frequência por região da roleta
export const generateRouletteRegionData = (numbers: number[]) => {
  const regionFrequency = ROULETTE_REGIONS.map(region => {
    const count = numbers.filter(num => region.numbers.includes(num)).length;
    return {
      name: region.name,
      count,
      percentage: numbers.length > 0 ? (count / numbers.length) * 100 : 0
    };
  });

  return regionFrequency;
};

// Função para gerar heatmap da roleta
export const generateRouletteHeatmap = (numbers: number[]) => {
  // Inicializar contagem para cada número da roleta
  const frequency: Record<number, number> = {};
  ROULETTE_NUMBERS.forEach(num => {
    frequency[num] = 0;
  });
  
  // Contar ocorrências
  numbers.forEach(num => {
    if (frequency[num] !== undefined) {
      frequency[num]++;
    }
  });
  
  // Encontrar o valor máximo para normalização
  const maxFrequency = Math.max(...Object.values(frequency), 1);
  
  // Criar dados para a visualização
  return ROULETTE_NUMBERS.map(num => {
    const count = frequency[num] || 0;
    const intensity = maxFrequency > 0 ? count / maxFrequency : 0;
    
    // Determinar cor para o número
    let color;
    if (num === 0) {
      // Verde para zero
      color = `hsl(142.1, 70.6%, ${45 + (intensity * 30)}%)`;
    } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
      // Vermelho com intensidade baseada na frequência
      color = `hsl(0, 72.2%, ${50 + (intensity * 30)}%)`;
    } else {
      // Preto com intensidade baseada na frequência
      color = `hsl(220, 14%, ${20 + (intensity * 20)}%)`;
    }
    
    return {
      number: num,
      count,
      percentage: numbers.length > 0 ? (count / numbers.length) * 100 : 0,
      intensity,
      color
    };
  });
};

// Determine color for a roulette number
export const getRouletteNumberColor = (num: number) => {
  if (num === 0) return "bg-[hsl(142.1,70.6%,45.3%)] text-white";
  
  // Red numbers
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  
  if (redNumbers.includes(num)) {
    return "text-white bg-[hsl(0,72.2%,50.6%)]";
  } else {
    return "text-white bg-[hsl(220,14%,20%)]";
  }
};

// Adicionar estilos CSS para a animação da roleta
const rouletteStyles = {
  table: {
    rotateAnimation: `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `,
    rotateSlow: {
      animation: 'spin 60s linear infinite',
    },
    pocketOuter: {
      background: 'radial-gradient(circle at center, #463F30 0%, #2c2416 100%)'
    },
    borderGold: {
      background: 'linear-gradient(to bottom, #ffd700, #b8860b)'
    }
  }
};

// <<< NOVA INTERFACE para condição da estratégia >>>
interface StrategyCondition {
  id: string; // Para key no map e remoção
  type: string; // Ex: 'color', 'number_streak', 'dozen_miss'
  operator: string; // Ex: 'equals', 'not_equals', 'streak_count', 'miss_count'
  value: any; // Ex: 'red', 5, '1st_dozen'
}

// <<< NOVAS DEFINIÇÕES para tipos, operadores e valores >>>
const conditionTypes = [
  { value: 'color', label: 'Cor (Último Giro)' },
  { value: 'number', label: 'Número Específico (Último Giro)' },
  { value: 'parity', label: 'Paridade (Último Giro)' },
  { value: 'dozen', label: 'Dúzia (Último Giro)' },
  { value: 'column', label: 'Coluna (Último Giro)' },
  { value: 'high_low', label: 'Metade (Último Giro)' },
  { value: 'streak_color', label: 'Sequência de Cor Atual' },
  { value: 'miss_color', label: 'Cor Não Saiu Por (Giros)' },
  // { value: 'streak_number', label: 'Sequência de Número' }, // Exemplo futuro
  // { value: 'miss_dozen', label: 'Dúzia Não Saiu Por' }, // Exemplo futuro
];

const operatorsByType: Record<string, { value: string, label: string }[]> = {
  'color': [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
  ],
  'number': [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
  ],
  'parity': [
    { value: 'equals', label: 'É' },
  ],
  'dozen': [
     { value: 'equals', label: 'É' },
     { value: 'not_equals', label: 'Não é' },
  ],
  'column': [
      { value: 'equals', label: 'É' },
      { value: 'not_equals', label: 'Não é' },
  ],
  'high_low': [
       { value: 'equals', label: 'É' },
  ],
  'streak_color': [
    { value: 'equals', label: '=' },
    { value: 'greater_equal', label: '>=' },
  ],
  'miss_color': [
    { value: 'equals', label: '=' },
    { value: 'greater_equal', label: '>=' },
  ],
};

const colorOptions = [
  { value: 'red', label: 'Vermelho' },
  { value: 'black', label: 'Preto' },
  { value: 'green', label: 'Verde (0)' },
];
const parityOptions = [
   { value: 'even', label: 'Par' },
   { value: 'odd', label: 'Ímpar' },
];
const dozenOptions = [
   { value: '1st', label: '1ª (1-12)' },
   { value: '2nd', label: '2ª (13-24)' },
   { value: '3rd', label: '3ª (25-36)' },
];
const columnOptions = [
    { value: '1st', label: '1ª Coluna' },
    { value: '2nd', label: '2ª Coluna' },
    { value: '3rd', label: '3ª Coluna' },
];
const highLowOptions = [
    { value: 'low', label: 'Baixo (1-18)' },
    { value: 'high', label: 'Alto (19-36)' },
];

// <<< NOVO COMPONENTE para input dinâmico de valor >>>
interface ConditionValueInputProps {
  conditionType: string;
  operator: string; 
  value: any; // Pode ser string, number, ou { color: string; count: number | null }
  onChange: (newValue: any) => void;
  disabled: boolean;
}

const ConditionValueInput: React.FC<ConditionValueInputProps> = ({
  conditionType,
  operator,
  value,
  onChange,
  disabled
}) => {
  // Helper para garantir que value seja um objeto para tipos complexos
  const getValueObject = (): { color: string; count: number | null } => {
    if (typeof value === 'object' && value !== null && 'color' in value && 'count' in value) {
      // Se count for string vazia ou inválida no estado antigo, trata como null
      const count = typeof value.count === 'number' ? value.count : null;
      return { ...value, count }; 
    }
    // Se não for objeto ou não tiver as chaves, retorna um padrão com null
    return { color: '', count: null };
  };

  const commonProps = { // Props comuns para inputs/selects
    disabled: disabled,
    className: "bg-input border-border h-9 text-sm w-full" // Garante largura total dentro do grid
  };

  switch (conditionType) {
    // --- Tipos Simples (sem alterações significativas, apenas garantindo fallback para '') ---
    case 'color':
      return (
        <Select 
            value={value || ''} 
            onValueChange={onChange} 
            disabled={disabled}
        >
          <SelectTrigger className={commonProps.className}><SelectValue placeholder="Cor..." /></SelectTrigger>
          <SelectContent className="bg-card border-border text-white z-[9999]">
            {colorOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    case 'number': // Input para número simples (0-36)
      return (
        <Input
          {...commonProps}
          // Lida com null/undefined no value
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
                onChange(''); // Ou talvez null? String vazia é mais comum para input controlado
            } else {
                const num = parseInt(val, 10);
                // Permite apenas números no range, ou string vazia
                if (!isNaN(num) && num >= 0 && num <= 36) {
                     onChange(num); 
                } else if (!isNaN(num) && (num < 0 || num > 36)){
                     // Se fora do range, não atualiza (ou pode mostrar erro)
                     // Poderia chamar onChange com o valor antigo ou null/''
                     // Por simplicidade, não atualizamos o estado com valor inválido
                } else {
                   // Se não for número (ex: 'abc'), não atualiza o estado
                }
            }
          }}
          type="number"
          placeholder="0-36"
          // min/max são validações do browser, mas onChange controla o estado
          min={0}
          max={36}
        />
      );
     // ... (outros cases simples: parity, dozen, column, high_low - usar value={value || ''}) ...
     case 'parity':
        return (
         <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
             <SelectTrigger className={commonProps.className}><SelectValue placeholder="Paridade..." /></SelectTrigger>
             <SelectContent className="bg-card border-border text-white z-[9999]">
                 {parityOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
             </SelectContent>
         </Select>
        );
    case 'dozen':
        return (
         <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
             <SelectTrigger className={commonProps.className}><SelectValue placeholder="Dúzia..." /></SelectTrigger>
             <SelectContent className="bg-card border-border text-white z-[9999]">
                 {dozenOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
             </SelectContent>
         </Select>
        );
    case 'column':
         return (
          <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
              <SelectTrigger className={commonProps.className}><SelectValue placeholder="Coluna..." /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white z-[9999]">
                  {columnOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
          </Select>
         );
    case 'high_low':
         return (
          <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
              <SelectTrigger className={commonProps.className}><SelectValue placeholder="Metade..." /></SelectTrigger>
              <SelectContent className="bg-card border-border text-white z-[9999]">
                  {highLowOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
              </SelectContent>
          </Select>
         );

    // --- Tipos Complexos (streak_color, miss_color) ---
    case 'streak_color':
    case 'miss_color': {
        const currentValue = getValueObject(); // Garante { color: string; count: number | null }
        const colorValue = currentValue.color;
        const countValue = currentValue.count; // Agora pode ser number | null

        const streakMissColorOptions = colorOptions.filter(opt => opt.value !== 'green'); 

        const handleColorChange = (newColor: string) => {
            // Preserva a contagem atual (seja number ou null)
            onChange({ ...currentValue, color: newColor }); 
        };

        // ATUALIZADO handleCountChange
        const handleCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const rawValue = e.target.value;
            if (rawValue === '') {
                // Se input está vazio, atualiza estado para count: null
                onChange({ ...currentValue, count: null });
            } else {
                const newCount = parseInt(rawValue, 10);
                // Se for um número inteiro válido e positivo, atualiza o estado
                if (!isNaN(newCount) && newCount >= 1) { 
                    onChange({ ...currentValue, count: newCount });
                } else {
                    // Se for inválido (texto, zero, negativo), não atualiza o estado.
                    // O input mostrará o valor inválido, mas o estado permanece.
                }
            }
        };

        return (
            <div className="grid grid-cols-2 gap-2 w-full">
                {/* Select Cor (sem mudanças aqui) */}
                <Select 
                    value={colorValue} 
                    onValueChange={handleColorChange} 
                    disabled={disabled}
                >
                    <SelectTrigger className={commonProps.className}><SelectValue placeholder="Cor..." /></SelectTrigger>
                    <SelectContent className="bg-card border-border text-white z-[9999]">
                         {streakMissColorOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                     </SelectContent>
                </Select>
                
                {/* Input Contagem - ATUALIZADO value prop */}
                 <Input
                    {...commonProps}
                    // Converte null para '' para o input, senão usa String()
                    value={countValue === null ? '' : String(countValue)}
                    onChange={handleCountChange}
                    type="number"
                    placeholder="Giros"
                    min={1} // Validação do browser
                 />
             </div>
         );
    }
    default:
      // Fallback (mantém input simples, usa value || '')
      return (
        <Input
          {...commonProps}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Valor..."
        />
      );
  }
};

// <<< NOVA INTERFACE PARA ESTRATÉGIAS SALVAS >>>
interface SavedStrategy {
  _id: string; // MongoDB ID
  name: string;
  conditions: StrategyCondition[]; // Reutiliza a interface StrategyCondition
  roletaId?: string;
  createdAt: string; // Ou Date, dependendo de como a API retorna
  updatedAt: string; // Ou Date
}

// Função para calcular probabilidades com modelo de rede neural simplificado
export const generateNeuralPredictions = (numbers: number[]) => {
  // Implementação simplificada baseada em padrões recentes
  // Em produção, seria substituída por um modelo real treinado
  const predictions = [];
  
  // Inicializa com probabilidades base
  for (let i = 0; i <= 36; i++) {
    predictions[i] = { number: i, probability: 2.7 }; // Probabilidade base (aproximadamente 1/37)
  }
  
  // Ajusta baseado em frequências recentes (últimos 200 números)
  const recentNumbers = numbers.slice(0, 200);
  const frequencyData = generateFrequencyData(recentNumbers);
  
  // Ajuste baseado em frequência histórica
  frequencyData.forEach(item => {
    const adjustment = (item.frequency / Math.max(recentNumbers.length, 1)) * 100;
    predictions[item.number].probability = parseFloat((adjustment).toFixed(1));
  });
  
  // Normaliza para que a soma seja 100%
  const totalProbability = predictions.reduce((sum, item) => sum + item.probability, 0);
  predictions.forEach(item => {
    item.probability = parseFloat((item.probability * 100 / totalProbability).toFixed(1));
  });
  
  return predictions.sort((a, b) => b.probability - a.probability);
};

// Função para calcular números devidos (regressão à média)
export const calculateDueNumbers = (numbers: number[]) => {
  const expectedFrequency = numbers.length / 37; // Frequência esperada de cada número
  const frequencyData = generateFrequencyData(numbers);
  
  // Calcula desvio da média esperada
  return frequencyData.map(item => {
    const deviation = expectedFrequency - item.frequency;
    const dueFactor = parseFloat((deviation / expectedFrequency).toFixed(2));
    return {
      number: item.number,
      dueFactor,
      isStatisticallySignificant: Math.abs(dueFactor) > 0.5 // Significativo se desvio > 50%
    };
  }).sort((a, b) => b.dueFactor - a.dueFactor); // Ordena do mais devido ao menos
};

// Função para calcular correlações temporais
export const calculateTimePatterns = (numbersWithTimestamp: RouletteNumber[]) => {
  const hourPatterns: Record<number, number[]> = {};
  
  // Inicializa buckets para cada hora (0-23)
  for (let i = 0; i < 24; i++) {
    hourPatterns[i] = [];
  }
  
  // Agrupa números por hora do dia
  numbersWithTimestamp.forEach(entry => {
    if (!entry.timestamp) return;
    
    const date = new Date(entry.timestamp);
    const hour = date.getHours();
    hourPatterns[hour].push(entry.numero);
  });
  
  // Calcula números mais frequentes para cada hora
  const hourlyTopNumbers: Record<number, {number: number, frequency: number}[]> = {};
  
  Object.entries(hourPatterns).forEach(([hour, nums]) => {
    const hourNum = parseInt(hour);
    if (nums.length === 0) {
      hourlyTopNumbers[hourNum] = [];
      return;
    }
    
    const freqMap: Record<number, number> = {};
    nums.forEach(num => {
      freqMap[num] = (freqMap[num] || 0) + 1;
    });
    
    hourlyTopNumbers[hourNum] = Object.entries(freqMap)
      .map(([num, freq]) => ({ 
        number: parseInt(num), 
        frequency: freq 
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 3); // Top 3 números por hora
  });
  
  // Descobre a "hora favorável" atual
  const currentHour = new Date().getHours();
  const favorableNumbers = hourlyTopNumbers[currentHour] || [];
  
  return {
    hourlyPatterns: hourlyTopNumbers,
    currentHourFavorableNumbers: favorableNumbers,
    currentHour
  };
};

// Função para calcular matriz de transição de Markov
export const calculateMarkovTransitions = (numbers: number[]) => {
  const transitions: Record<string, Record<string, number>> = {};
  
  // Inicializa matriz de transição
  for (let i = 0; i <= 36; i++) {
    transitions[i] = {};
    for (let j = 0; j <= 36; j++) {
      transitions[i][j] = 0;
    }
  }
  
  // Preenche a matriz contando transições
  for (let i = 0; i < numbers.length - 1; i++) {
    const current = numbers[i];
    const next = numbers[i + 1];
    
    if (transitions[current]) {
      transitions[current][next] = (transitions[current][next] || 0) + 1;
    }
  }
  
  // Calcula probabilidades
  const markovProbabilities: { from: number, to: number, probability: number }[] = [];
  
  Object.entries(transitions).forEach(([fromStr, toObj]) => {
    const from = parseInt(fromStr);
    
    // Conta total de transições deste número
    const total = Object.values(toObj).reduce((sum, count) => sum + (count as number), 0);
    
    if (total > 0) {
      Object.entries(toObj).forEach(([toStr, count]) => {
        const to = parseInt(toStr);
        const probability = parseFloat(((count as number) / total).toFixed(2));
        
        // Incluir apenas transições com probabilidade significativa
        if (probability > 0.05) {
          markovProbabilities.push({ from, to, probability });
        }
      });
    }
  });
  
  // Ordena por probabilidade
  return markovProbabilities.sort((a, b) => b.probability - a.probability);
};

// Função para calcular momentum estatístico
export const calculateMomentum = (numbers: number[]) => {
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  const recent = numbers.slice(0, 20); // Últimos 20 números
  
  // Momentum de cores
  const redCount = recent.filter(n => redNumbers.includes(n)).length;
  const blackCount = recent.filter(n => n !== 0 && !redNumbers.includes(n)).length;
  const colorMomentum = parseFloat(((redCount - blackCount) / Math.max(recent.length, 1)).toFixed(2));
  
  // Momentum de paridade
  const evenCount = recent.filter(n => n !== 0 && n % 2 === 0).length;
  const oddCount = recent.filter(n => n !== 0 && n % 2 !== 0).length;
  const parityMomentum = parseFloat(((evenCount - oddCount) / Math.max(recent.length, 1)).toFixed(2));
  
  // Momentum de alta/baixa
  const highCount = recent.filter(n => n >= 19 && n <= 36).length;
  const lowCount = recent.filter(n => n >= 1 && n <= 18).length;
  const highLowMomentum = parseFloat(((highCount - lowCount) / Math.max(recent.length, 1)).toFixed(2));
  
  return {
    color: {
      value: colorMomentum,
      direction: colorMomentum > 0 ? 'vermelho' : 'preto',
      strength: Math.abs(colorMomentum)
    },
    parity: {
      value: parityMomentum,
      direction: parityMomentum > 0 ? 'par' : 'ímpar',
      strength: Math.abs(parityMomentum)
    },
    highLow: {
      value: highLowMomentum,
      direction: highLowMomentum > 0 ? 'alta' : 'baixa',
      strength: Math.abs(highLowMomentum)
    }
  };
};

// Função para detectar anomalias estatísticas
export const detectAnomalies = (numbers: number[]) => {
  const anomalies = [];
  const recent = numbers.slice(0, 500); // Analisar últimos 500 números
  
  // Detecção de sequências de mesma cor
  const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
  let currentColorStreak = 1;
  let currentColor = redNumbers.includes(recent[0]) ? 'red' : (recent[0] === 0 ? 'green' : 'black');
  
  for (let i = 1; i < recent.length; i++) {
    const num = recent[i];
    const color = redNumbers.includes(num) ? 'red' : (num === 0 ? 'green' : 'black');
    
    if (color === currentColor) {
      currentColorStreak++;
    } else {
      if (currentColorStreak >= 7) { // 7+ números da mesma cor é estatisticamente improvável
        anomalies.push({
          type: 'color_streak',
          description: `${currentColorStreak} números ${currentColor === 'red' ? 'vermelhos' : (currentColor === 'black' ? 'pretos' : 'zero')} consecutivos`,
          severity: currentColorStreak >= 10 ? 'alta' : 'média',
          position: i - currentColorStreak
        });
      }
      currentColor = color;
      currentColorStreak = 1;
    }
  }
  
  // Detecção de muitos zeros em curto período
  const zeroCount = recent.slice(0, 100).filter(n => n === 0).length;
  if (zeroCount >= 4) { // 4+ zeros em 100 giros é incomum
    anomalies.push({
      type: 'zero_frequency',
      description: `${zeroCount} zeros nos últimos 100 números`,
      severity: zeroCount >= 6 ? 'alta' : 'média',
      position: 0
    });
  }
  
  // Detecção de desvio significativo de distribuição esperada
  const expectedPerBin = recent.length / 3; // Esperado para cada terço da roleta
  const binCounts = [
    recent.filter(n => n >= 1 && n <= 12).length,
    recent.filter(n => n >= 13 && n <= 24).length,
    recent.filter(n => n >= 25 && n <= 36).length
  ];
  
  binCounts.forEach((count, index) => {
    const deviation = Math.abs(count - expectedPerBin) / expectedPerBin;
    if (deviation > 0.20) { // Desvio maior que 20% é significativo
      anomalies.push({
        type: 'distribution_deviation',
        description: `Desvio de ${(deviation * 100).toFixed(0)}% na frequência dos números ${index * 12 + 1}-${(index + 1) * 12}`,
        severity: deviation > 0.30 ? 'alta' : 'média',
        position: -1
      });
    }
  });
  
  return anomalies;
};

export const RouletteSidePanelStats = ({ 
  roletaId,
  roletaNome, 
  lastNumbers, 
  wins, 
  losses,
  providers = [] 
}: RouletteSidePanelStatsProps): JSX.Element => {
  // Validar e logar quando roletaId está indefinido
  const validRouletteIdentifier = useMemo(() => {
    if (!roletaId) {
      logger.warn(`[RouletteSidePanelStats] Componente inicializado com roletaId undefined para ${roletaNome}. Usando o nome da roleta como identificador.`);
      // Usar o nome da roleta como identificador alternativo
      return roletaNome || '';
    }
    return roletaId;
  }, [roletaId, roletaNome]);
  
  const [historicalNumbers, setHistoricalNumbers] = useState<RouletteNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleNumbersCount, setVisibleNumbersCount] = useState(44);
  const [colorFilter, setColorFilter] = useState<ColorFilter>('todos');
  const isInitialRequestDone = useRef(false);
  const unifiedClient = UnifiedRouletteClient.getInstance();
  const [hasActiveFilters, setHasActiveFilters] = useState(false);
  const [selectedColor, setSelectedColor] = useState('todas');
  const [selectedNumber, setSelectedNumber] = useState<SelectedNumberState>(null);
  const [selectedParity, setSelectedParity] = useState('todas');
  const [selectedTime, setSelectedTime] = useState('todas');
  const [selectedProvider, setSelectedProvider] = useState('todas');
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [highlightedNumber, setHighlightedNumber] = useState<SelectedNumberState>(null);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [componentInstanceId, setComponentInstanceId] = useState(uniqueId('roulette-side-panel-'));
  
  // Referências para controlar ciclo de vida e evitar múltiplas remontagens
  const currentRouletteRef = useRef<{ id: string; name: string }>({ id: '', name: '' });
  const listenersRef = useRef<{
    unsubscribeUpdate?: () => void;
    unsubscribeInitialLoad?: () => void;
    unsubscribeInitialError?: () => void;
  }>({});
  
  // Estados para o formulário de criação de estratégia
  const [isStrategyModalOpen, setIsStrategyModalOpen] = useState(false);
  const [strategyName, setStrategyName] = useState('');
  const [strategyConditions, setStrategyConditions] = useState<StrategyCondition[]>([]);
  const [isSavingStrategy, setIsSavingStrategy] = useState(false);
  const [saveStrategyError, setSaveStrategyError] = useState<string | null>(null);
  const [saveStrategySuccess, setSaveStrategySuccess] = useState<string | null>(null);

  // <<< NOVOS ESTADOS PARA GERENCIAR ESTRATÉGIAS SALVAS >>>
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  const [fetchStrategiesError, setFetchStrategiesError] = useState<string | null>(null);
  const [deleteStrategyError, setDeleteStrategyError] = useState<string | null>(null);
  const [deleteStrategySuccess, setDeleteStrategySuccess] = useState<string | null>(null);
  const [deletingStrategyId, setDeletingStrategyId] = useState<string | null>(null);
  const [strategiesLoaded, setStrategiesLoaded] = useState(false);

  // Novos estados para estatísticas inteligentes
  const [neuralPredictions, setNeuralPredictions] = useState<{number: number, probability: number}[]>([]);
  const [dueNumbers, setDueNumbers] = useState<{number: number, dueFactor: number, isStatisticallySignificant: boolean}[]>([]);
  const [timePatterns, setTimePatterns] = useState<{hourlyPatterns: Record<number, any[]>, currentHourFavorableNumbers: any[], currentHour: number}>({
    hourlyPatterns: {},
    currentHourFavorableNumbers: [],
    currentHour: 0
  });
  const [momentumData, setMomentumData] = useState<any>(null);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [markovTransitions, setMarkovTransitions] = useState<{from: number, to: number, probability: number}[]>([]);
  
  // Esta função será chamada pelo listener do 'update' do UnifiedClient
  const processRouletteUpdate = useCallback((updatedRouletteData: any) => {
    if (!updatedRouletteData || !Array.isArray(updatedRouletteData.numero)) {
        logger.warn('Dados de atualização inválidos recebidos', updatedRouletteData);
        return;
    }

    // Extrair números e timestamps da atualização
    const apiNumbersWithTimestamp: RouletteNumber[] = updatedRouletteData.numero.map((item: any) => {
        let timeString = "00:00";
        if (item.timestamp) {
          try {
                const date = new Date(item.timestamp);
            timeString = date.getHours().toString().padStart(2, '0') + ':' + 
                       date.getMinutes().toString().padStart(2, '0');
          } catch (e) {
            logger.error("Erro ao converter timestamp:", e);
          }
        }
        return {
            numero: Number(item.numero),
          timestamp: timeString
        };
    }).filter((n: any) => !isNaN(n.numero) && n.numero >= 0 && n.numero <= 36);
      
    if (apiNumbersWithTimestamp.length === 0) {
        logger.info('Nenhum número válido na atualização recebida.');
      return;
    }
    
    setHistoricalNumbers(currentNumbers => {
        // Lógica para adicionar apenas números *novos* ao histórico existente
        const currentNumerosSet = new Set(currentNumbers.map(n => n.numero + '_' + n.timestamp)); // Usar timestamp para diferenciar
        const newNumbersToAdd: RouletteNumber[] = [];

        for (const apiNum of apiNumbersWithTimestamp) {
            const uniqueKey = apiNum.numero + '_' + apiNum.timestamp;
            // Adiciona apenas se for realmente novo (não presente no estado atual)
            // e se o número anterior na lista da API não for igual ao primeiro número atual
            // (evita adicionar o mesmo número várias vezes se a API enviar repetido)
            if (!currentNumerosSet.has(uniqueKey) && apiNum.numero !== currentNumbers[0]?.numero) {
                 newNumbersToAdd.push(apiNum);
                 // Adiciona ao set para evitar duplicatas dentro do mesmo lote de atualização
                 currentNumerosSet.add(uniqueKey); 
    } else {
                 // Se encontrarmos um número que já existe ou é o mesmo que o último, paramos de adicionar deste lote
                 break; 
            }
        }

        if (newNumbersToAdd.length > 0) {
            logger.info(`${newNumbersToAdd.length} novos números recebidos via atualização para ${roletaNome}: ${newNumbersToAdd.map(n => n.numero).join(', ')}`);
            const updatedNumbers = [...newNumbersToAdd, ...currentNumbers];
            return updatedNumbers.slice(0, 1000); // Limitar a 1000 números
        }

        // Se não há números novos, retorna o estado atual sem modificação
        return currentNumbers;
    });

  }, [roletaNome]);

  // Função para configurar os listeners - extraída para reutilização
  const setupListeners = useCallback(() => {
    // Limpar listeners existentes antes de criar novos
    if (listenersRef.current.unsubscribeUpdate) {
      listenersRef.current.unsubscribeUpdate();
    }
    if (listenersRef.current.unsubscribeInitialLoad) {
      listenersRef.current.unsubscribeInitialLoad();
    }
    if (listenersRef.current.unsubscribeInitialError) {
      listenersRef.current.unsubscribeInitialError();
    }
    
    logger.info(`[${componentInstanceId}] Configurando listeners para ${roletaNome} (Roleta ID: ${roletaId || 'undefined'})`);
    
    const handleUpdate = (updatedData: any) => {
      let myRouletteUpdate: any = null;
      if (Array.isArray(updatedData)) {
        myRouletteUpdate = updatedData.find(r => (r.name || r.nome)?.toLowerCase() === roletaNome.toLowerCase());
      } else if (updatedData && typeof updatedData === 'object') {
        const currentRouletteName = updatedData.name || updatedData.nome || '';
        if (currentRouletteName.toLowerCase() === roletaNome.toLowerCase()) {
          myRouletteUpdate = updatedData;
        }
      }
      if (myRouletteUpdate) {
        logger.info(`[${componentInstanceId}] Recebido 'update' para ${roletaNome}`);
        if (!isInitialRequestDone.current) {
          logger.info(`[${componentInstanceId}] Primeira atualização recebida para ${roletaNome}, preenchendo histórico inicial.`);
    setIsLoading(false);
    isInitialRequestDone.current = true;
        }
        processRouletteUpdate(myRouletteUpdate);
      }
    };
    
    const handleInitialHistoryLoaded = (allHistoryData: Map<string, RouletteNumber[]>) => {
      logger.info(`[${componentInstanceId}] Evento 'initialHistoryLoaded' recebido.`);
      const initialDataForThisRoulette = allHistoryData.get(roletaNome);
      if (initialDataForThisRoulette && historicalNumbers.length === 0) { 
        logger.info(`[${componentInstanceId}] Preenchendo histórico com dados de 'initialHistoryLoaded' para ${roletaNome}`);
        setHistoricalNumbers(initialDataForThisRoulette);
      }
      setIsLoading(false); 
      isInitialRequestDone.current = true;
    };
    
    const handleInitialHistoryError = (error: any) => {
      logger.error(`[${componentInstanceId}] Erro ao carregar histórico inicial reportado pelo UnifiedClient:`, error);
      setIsLoading(false); 
      isInitialRequestDone.current = true;
    };
    
    // Registrar listeners e manter referências para limpeza
    listenersRef.current.unsubscribeUpdate = unifiedClient.on('update', handleUpdate);
    listenersRef.current.unsubscribeInitialLoad = unifiedClient.on('initialHistoryLoaded', handleInitialHistoryLoaded);
    listenersRef.current.unsubscribeInitialError = unifiedClient.on('initialHistoryError', handleInitialHistoryError);
    
    // Atualizar referência da roleta atual
    currentRouletteRef.current = { id: roletaId || '', name: roletaNome };
    
    return () => {
      logger.info(`[${componentInstanceId}] Limpando listeners para ${roletaNome}`);
      if (listenersRef.current.unsubscribeUpdate) {
        listenersRef.current.unsubscribeUpdate();
      }
      if (listenersRef.current.unsubscribeInitialLoad) {
        listenersRef.current.unsubscribeInitialLoad();
      }
      if (listenersRef.current.unsubscribeInitialError) {
        listenersRef.current.unsubscribeInitialError();
      }
    };
  }, [componentInstanceId, roletaNome, roletaId, unifiedClient, processRouletteUpdate, logger, historicalNumbers.length]);
  
  // useEffect centralizado para inicialização do componente
  useEffect(() => {
    // Gerar ID de instância apenas uma vez quando o componente monta
    if (!componentInstanceId) {
      setComponentInstanceId(uniqueId('roulette-side-panel-'));
      return;
    }
    
    const isNewRoulette = 
      roletaNome !== currentRouletteRef.current.name || 
      roletaId !== currentRouletteRef.current.id;
    
    // Se a roleta mudou, resetar o estado
    if (isNewRoulette) {
      logger.info(`[${componentInstanceId}] Mudança de roleta detectada: ${currentRouletteRef.current.name} -> ${roletaNome}`);
      setIsLoading(true);
      isInitialRequestDone.current = false;
      setHistoricalNumbers([]);
      
      // Carregar dados pré-carregados se disponíveis
      const preloadedData = unifiedClient.getPreloadedHistory(roletaNome);
      if (preloadedData && preloadedData.length > 0) {
        logger.info(`[${componentInstanceId}] Usando ${preloadedData.length} números pré-carregados para ${roletaNome}`);
        setHistoricalNumbers(preloadedData);
        setIsLoading(false);
        isInitialRequestDone.current = true;
      } else {
        logger.warn(`[${componentInstanceId}] Nenhum histórico pré-carregado encontrado para ${roletaNome}. Aguardando busca inicial ou atualizações...`);
        setIsLoading(false);
        isInitialRequestDone.current = true;
      }
      
      // Configurar novos listeners
      const cleanup = setupListeners();
      
      // Retornar função de limpeza apenas se a roleta mudou
      return cleanup;
    }
    
    // Se não é uma nova roleta, não fazer nada
    // Isso evita remontagens desnecessárias dos listeners
  }, [componentInstanceId, roletaId, roletaNome, unifiedClient, setupListeners, logger]);
  
  // Efeito de cleanup quando componente é desmontado completamente
  useEffect(() => {
    return () => {
      logger.info(`[${componentInstanceId}] Desmontando componente RouletteSidePanelStats para ${roletaNome}`);
      // Limpar todos os listeners
      if (listenersRef.current.unsubscribeUpdate) {
        listenersRef.current.unsubscribeUpdate();
      }
      if (listenersRef.current.unsubscribeInitialLoad) {
        listenersRef.current.unsubscribeInitialLoad();
      }
      if (listenersRef.current.unsubscribeInitialError) {
        listenersRef.current.unsubscribeInitialError();
      }
    };
  }, [componentInstanceId, logger, roletaNome]);

  // Função para mostrar mais números
  const handleShowMore = () => {
    // Calcular dinamicamente quantos números mostrar com base no total disponível
    const incremento = Math.min(50, Math.max(20, Math.floor(filteredNumbers.length * 0.1)));
    setVisibleNumbersCount(prev => Math.min(prev + incremento, filteredNumbers.length));
  };

  // Função para filtrar números por cor
  const handleFilterByColor = (color: ColorFilter) => {
    setColorFilter(color);
    // Ao mudar o filtro, resetamos a contagem para evitar páginas vazias
    setVisibleNumbersCount(30);
  };

  // Filtrar números pela cor selecionada
  const filteredNumbers = useMemo(() => {
    let filtered = [...historicalNumbers];
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    // 1. Filtro por cor
    if (selectedColor !== 'todas') {
      filtered = filtered.filter(item => {
        if (selectedColor === 'verde') return item.numero === 0;
        if (selectedColor === 'vermelho') return redNumbers.includes(item.numero);
        if (selectedColor === 'preto') return item.numero !== 0 && !redNumbers.includes(item.numero);
        return true;
      });
    }
    
    // 2. Filtro por número
    if (selectedNumber !== null) {
      filtered = filtered.filter(item => item.numero === selectedNumber);
    }
    
    // 3. Filtro por paridade
    if (selectedParity !== 'todas') {
      filtered = filtered.filter(item => {
        if (item.numero === 0) return false; // Zero não é par nem ímpar
        const isPar = item.numero % 2 === 0;
        return selectedParity === 'par' ? isPar : !isPar;
      });
    }
    
    // 4. Filtro por tempo/minuto
    if (selectedTime !== 'todos') {
      const minuteValue = parseInt(selectedTime, 10);
      if (!isNaN(minuteValue)) {
        filtered = filtered.filter(item => {
          // Extrair minuto do timestamp
          const minute = parseInt(item.timestamp.split(':')[1]);
          // Verificar se o minuto do timestamp é igual ao valor selecionado
          return minute === minuteValue;
        });
      }
    }
    
    // 5. Filtro por provedor
    if (selectedProviders.length > 0) {
      // Implementar lógica de filtro por provedor se necessário
    }
    
    return filtered;
  }, [historicalNumbers, selectedColor, selectedNumber, selectedParity, selectedTime, selectedProviders]);

  const visibleNumbers = filteredNumbers.slice(0, visibleNumbersCount);

  const frequencyData = generateFrequencyData(historicalNumbers.map(n => n.numero));
  const { hot, cold } = getHotColdNumbers(frequencyData);
  const pieData = generateGroupDistribution(historicalNumbers.map(n => n.numero));
  const colorHourlyStats = generateColorHourlyStats(historicalNumbers.map(n => n.numero));
  
  const winRate = (wins / (wins + losses)) * 100;

  // Opções para o filtro de números
  const numberOptions = [
    { value: 'todos', label: 'Todos' },
    { value: '0', label: '0' },
    ...Array.from({ length: 36 }, (_, i) => ({
      value: String(i + 1),
      label: String(i + 1)
    }))
  ];

  // Opções para o filtro de tempo
  const timeOptions = [
    { value: 'todos', label: 'Todos' },
    ...Array.from({ length: 60 }, (_, i) => ({
      value: String(i),
      label: String(i)
    }))
  ];

  // Handler para o filtro de cor
  const handleColorChange = (value: string) => {
    setSelectedColor(value as ColorFilter);
    let color: 'red' | 'black' | 'green' | null = null;
    
    switch (value) {
      case 'vermelho':
        color = 'red';
        break;
      case 'preto':
        color = 'black';
        break;
      case 'verde':
        color = 'green';
        break;
      case 'todas':
      default:
        color = null;
    }
    
    // Atualizar também o filtro de cor simples para manter compatibilidade
    setColorFilter(value as ColorFilter);
    checkActiveFilters();
  };

  // Handler para o filtro de número
  const handleNumberChange = (value: string) => {
    // Atualizar apenas o filtro, mantendo o destaque visual intacto
    setSelectedNumber(value === 'todos' ? null : parseInt(value, 10));
    // Não alterar o highlightedNumber aqui
    checkActiveFilters();
  };

  // Handler para o filtro de paridade
  const handleParityChange = (value: string) => {
    setSelectedParity(value);
    checkActiveFilters();
  };

  // Handler para o filtro de tempo
  const handleTimeChange = (value: string) => {
    setSelectedTime(value);
    checkActiveFilters();
  };

  // Handler para o filtro de provedor
  const handleProviderChange = (value: string) => {
    setSelectedProvider(value);
    
    if (value === 'todos') {
      setSelectedProviders([]);
    } else {
      setSelectedProviders([value]);
    }
    
    checkActiveFilters();
  };

  // Verificar se há filtros ativos
  const checkActiveFilters = () => {
    const hasFilters = 
      selectedColor !== 'todas' || 
      selectedNumber !== null || 
      selectedParity !== 'todas' || 
      selectedTime !== 'todos' || 
      selectedProvider !== 'todos' ||
      selectedProviders.length > 0;
    
    setHasActiveFilters(hasFilters);
  };

  // Limpar todos os filtros
  const handleClearAllFilters = () => {
    setSelectedColor('todas');
    setSelectedNumber(null);
    setSelectedParity('todas');
    setSelectedTime('todos');
    setSelectedProvider('todos');
    setSelectedProviders([]);
    setColorFilter('todos');
    
    setHasActiveFilters(false);
  };

  // Gerar dados de heatmap da roleta baseado no histórico
  const rouletteHeatmap = useMemo(() => 
    generateRouletteHeatmap(historicalNumbers.map(n => n.numero)), 
    [historicalNumbers]
  );
  
  // Gerar dados de regiões da roleta
  const rouletteRegionData = useMemo(() => 
    generateRouletteRegionData(historicalNumbers.map(n => n.numero)), 
    [historicalNumbers]
  );

  // Função para alternar a seleção de número para destaque visual
  const handleNumberSelection = (num: number) => {
    // Se o número já está destacado, limpa o destaque, senão destaca o número
    setHighlightedNumber(prevNumber => prevNumber === num ? null : num);
  };

  // <<< NOVA FUNÇÃO para chamar a API da IA >>>
  const handleAskAI = useCallback(async () => {
    // Log no início da função
    logger.info(`[${componentInstanceId}] handleAskAI chamada. Query: "${aiQuery}", RoletaID: "${validRouletteIdentifier}"`);

    if (!aiQuery.trim() || !validRouletteIdentifier) {
      // Log quando a validação falha
      logger.warn(`[${componentInstanceId}] Validação falhou em handleAskAI. Query válida: ${!!aiQuery.trim()}, RoletaID válida: ${!!validRouletteIdentifier}. Query: "${aiQuery}", RoletaID: "${validRouletteIdentifier}"`);
      setAiError("Por favor, digite sua pergunta e certifique-se que uma roleta está selecionada.");
      return;
    }
    
    logger.info(`[${componentInstanceId}] Enviando pergunta para IA sobre roleta ${validRouletteIdentifier}: ${aiQuery}`);
    setIsAiLoading(true);
    setAiResponse(null); // Limpa resposta anterior
    setAiError(null); // Limpa erro anterior

    try {
      const response = await axios.post('/api/ai/query', { 
        query: aiQuery, 
        roletaId: validRouletteIdentifier // Usar o ID validado
      });
      
      if (response.data && response.data.response) {
        setAiResponse(response.data.response);
      } else {
        throw new Error("Resposta inesperada da API de IA");
      }

    } catch (error: any) {
      logger.error("Erro ao chamar a API de IA:", error);
      setAiError(error.response?.data?.message || error.message || "Ocorreu um erro ao consultar a IA.");
      setAiResponse(null); // Garante que não haja resposta em caso de erro
    } finally {
      setIsAiLoading(false);
    }
  }, [aiQuery, validRouletteIdentifier, componentInstanceId, logger]);

  // <<< NOVA FUNÇÃO para adicionar uma condição vazia >>>
  const addCondition = () => {
    const newCondition: StrategyCondition = {
      id: uuidv4(),
      type: undefined,       // <<< ALTERADO para undefined
      operator: undefined,   // <<< ALTERADO para undefined
      value: '',             // Pode ser '' ou null. Vamos manter '' por enquanto.
    };
    setStrategyConditions(prev => [...prev, newCondition]);
  };
  
  // <<< NOVA FUNÇÃO para remover uma condição >>>
  const removeCondition = (idToRemove: string) => {
    setStrategyConditions(prev => prev.filter(c => c.id !== idToRemove));
  };
  
  // <<< Função updateCondition ATUALIZADA para resetar >>>
  const updateCondition = (idToUpdate: string, field: keyof Omit<StrategyCondition, 'id'>, newValue: any) => {
    setStrategyConditions(prev =>
      prev.map(condition => {
        if (condition.id === idToUpdate) {
          const updatedCondition = { ...condition, [field]: newValue };
          if (field === 'type') {
            console.log(`Tipo mudado para ${newValue}, resetando operador e valor.`);
            updatedCondition.operator = undefined; // <<< ALTERADO para undefined
            updatedCondition.value = '';         // <<< Reset para '' (ou null)
          }
          return updatedCondition;
        }
        return condition;
      })
    );
  };
  
  // <<< FUNÇÃO para salvar estratégia (atualizada para incluir conditions) >>>
  const handleSaveStrategy = async () => {
    // Limpar mensagens anteriores e definir estado de carregamento
    setSaveStrategyError(null);
    setSaveStrategySuccess(null);
    setIsSavingStrategy(true);

    // Validação básica
    if (!strategyName.trim()) {
      setSaveStrategyError("Por favor, dê um nome à sua estratégia.");
      setIsSavingStrategy(false);
      return;
    }
    if (strategyConditions.length === 0) {
      setSaveStrategyError("Adicione pelo menos uma condição à sua estratégia.");
      setIsSavingStrategy(false);
      return;
    }
    
    // Verificar identificador da roleta - agora pode ser ID ou nome
    if (!validRouletteIdentifier) {
      setSaveStrategyError("Não foi possível identificar a roleta atual. Tente novamente mais tarde.");
      setIsSavingStrategy(false);
      return;
    }
    
    // Validar se todas as condições têm tipo, operador e valor preenchidos
    for (const condition of strategyConditions) {
      if (!condition.type || !condition.operator || condition.value === '' || condition.value === undefined || condition.value === null) {
        // Para tipos complexos, value é um objeto
        if (typeof condition.value === 'object' && condition.value !== null) {
          const complexValue = condition.value as { color: string; count: number | null };
          if (!complexValue.color || complexValue.count === null || complexValue.count === undefined) {
            setSaveStrategyError(`Condição inválida: ${conditionTypes.find(ct => ct.value === condition.type)?.label || 'Tipo desconhecido'} requer cor e contagem.`);
            setIsSavingStrategy(false);
            return;
          }
        } else if (typeof condition.value !== 'object') { // Para tipos simples
          setSaveStrategyError(`Preencha todos os campos para cada condição (Tipo, Operador, Valor).`);
          setIsSavingStrategy(false);
          return;
        }
      }
    }

    try {
      logger.info(`[${componentInstanceId}] Salvando estratégia: ${strategyName}`);
      
      // Configurar timeout e retry
      let retryCount = 0;
      let success = false;
      
      while (!success && retryCount < 3) {
        try {
          // Se não for a primeira tentativa, mostrar mensagem
          if (retryCount > 0) {
            setSaveStrategyError(`Tempo limite excedido. Tentando novamente (${retryCount}/3)...`);
            // Esperar 1.5 segundos antes de tentar novamente
            await new Promise(resolve => setTimeout(resolve, 1500));
          }
          
          // Criar payload com dados para API
          const payload = {
            name: strategyName,
            conditions: strategyConditions,
            roletaId: roletaId || undefined, // Enviar undefined se não houver ID
            roletaNome: roletaNome // Sempre enviar o nome da roleta
          };
          
          const response = await axios.post('/api/strategies', payload, {
            timeout: 25000, // 25 segundos de timeout
            headers: {
              'Content-Type': 'application/json'
            }
          });
          
          // Se chegou até aqui, a requisição foi bem sucedida
          setSaveStrategySuccess("Estratégia salva com sucesso!");
          setStrategyName('');
          setStrategyConditions([]);
          success = true;
          
          // Atualiza as estratégias sem fazer nova chamada à API
          if (response.data && response.data.strategy) {
            setSavedStrategies(current => [response.data.strategy, ...current]);
          } else {
            // Se não tiver a estratégia na resposta, forçar recarga
            fetchSavedStrategies(true);
          }
          
        } catch (err: any) {
          logger.error(`[${componentInstanceId}] Erro ao salvar estratégia (tentativa ${retryCount + 1}):`, err);
          
          // Verificar se é um erro de timeout
          const isTimeoutError = 
            err.code === 'ECONNABORTED' || 
            (err.response && err.response.status === 504) ||
            err.message.includes('timeout');
          
          // Se for erro de timeout e ainda não esgotou as tentativas, tentar novamente
          if (isTimeoutError && retryCount < 2) {
            retryCount++;
            continue;
          }
          
          // Se chegou até aqui, é um erro que não vamos tentar novamente ou já esgotamos as tentativas
          if (err.response) {
            // Resposta do servidor com código de erro
            switch (err.response.status) {
              case 400:
                setSaveStrategyError(err.response.data.message || "Dados inválidos. Verifique os campos.");
                break;
              case 401:
                setSaveStrategyError("Você precisa estar autenticado para salvar estratégias.");
                break;
              case 408:
              case 504:
                setSaveStrategyError("O servidor demorou muito para responder. Tente novamente mais tarde.");
                break;
              case 500:
                setSaveStrategyError("Erro interno do servidor. Nossa equipe foi notificada.");
                break;
              default:
                setSaveStrategyError(err.response.data.message || `Erro ${err.response.status}: Falha ao salvar.`);
            }
          } else if (err.request) {
            // Requisição feita mas sem resposta
            setSaveStrategyError("Não foi possível obter resposta do servidor. Verifique sua conexão.");
          } else {
            // Erro na configuração da requisição
            setSaveStrategyError(`Erro ao preparar requisição: ${err.message}`);
          }
          
          // Sair do loop 
          break;
        }
      }
    } catch (error: any) {
      // Erros inesperados
      logger.error(`[${componentInstanceId}] Erro inesperado ao salvar estratégia:`, error);
      setSaveStrategyError(error.message || "Ocorreu um erro desconhecido.");
    } finally {
      setIsSavingStrategy(false);
    }
  };

  // Função para limpar mensagens ao fechar o modal
  useEffect(() => {
    if (!isStrategyModalOpen) {
        setSaveStrategyError(null);
        setSaveStrategySuccess(null);
        // Não limpar strategyName e conditions aqui, caso o usuário queira reabrir e continuar editando
        // A menos que tenha sido um salvamento bem sucedido.
    }
  }, [isStrategyModalOpen]);

  // <<< NOVA FUNÇÃO PARA BUSCAR ESTRATÉGIAS SALVAS >>>
  const fetchSavedStrategies = useCallback(async (forceReload = false) => {
    // Se as estratégias já foram carregadas e não estamos forçando recarga, retorna imediatamente
    if (strategiesLoaded && !forceReload) {
      logger.info(`[${componentInstanceId}] Estratégias já carregadas, ignorando solicitação de busca.`);
      return;
    }
    
    logger.info(`[${componentInstanceId}] Buscando estratégias salvas...`);
    setIsLoadingStrategies(true);
    setFetchStrategiesError(null);
    setDeleteStrategyError(null);
    setDeleteStrategySuccess(null);
    
    try {
      const response = await axios.get('/api/strategies');
      if (response.data && response.data.success) {
        setSavedStrategies(response.data.data);
        setStrategiesLoaded(true); // Marca que as estratégias foram carregadas com sucesso
        logger.info(`[${componentInstanceId}] ${response.data.data.length} estratégias carregadas.`);
      } else {
        throw new Error(response.data.message || "Falha ao buscar estratégias da API.");
      }
    } catch (error: any) {
      logger.error(`[${componentInstanceId}] Erro ao buscar estratégias salvas:`, error);
      setFetchStrategiesError(error.response?.data?.message || error.message || "Ocorreu um erro ao buscar as estratégias.");
      setSavedStrategies([]);
    } finally {
      setIsLoadingStrategies(false);
    }
  }, [componentInstanceId, logger, strategiesLoaded]);

  // <<< useEffect OTIMIZADO PARA BUSCAR ESTRATÉGIAS QUANDO O MODAL ABRIR >>>
  useEffect(() => {
    if (isStrategyModalOpen && !strategiesLoaded) {
      // Busca estratégias apenas se o modal estiver aberto E as estratégias não tiverem sido carregadas
      fetchSavedStrategies();
    }
  }, [isStrategyModalOpen, fetchSavedStrategies, strategiesLoaded]);
  
  // Função para limpar mensagens ao fechar o modal de criação/gerenciamento
  useEffect(() => {
    if (!isStrategyModalOpen) {
        setSaveStrategyError(null);
        setSaveStrategySuccess(null);
        setFetchStrategiesError(null); 
        setDeleteStrategyError(null);  
        setDeleteStrategySuccess(null); 
    }
  }, [isStrategyModalOpen]);

  // <<< FUNÇÃO PARA EXCLUIR ESTRATÉGIA >>>
  const handleDeleteStrategy = useCallback(async (strategyId: string) => {
    if (!strategyId) return;
    logger.info(`[${componentInstanceId}] Tentando excluir estratégia ID: ${strategyId}`);
    setDeletingStrategyId(strategyId); 
    setDeleteStrategyError(null);
    setDeleteStrategySuccess(null);
    try {
      const response = await axios.delete(`/api/strategies?id=${strategyId}`);
      if (response.data && response.data.success) {
        logger.info(`[${componentInstanceId}] Estratégia ${strategyId} excluída com sucesso.`);
        setDeleteStrategySuccess("Estratégia excluída com sucesso!");
        
        // Em vez de buscar novamente todas as estratégias, apenas remove a excluída do estado
        setSavedStrategies(current => current.filter(s => s._id !== strategyId));
      } else {
        throw new Error(response.data.message || "Falha ao excluir estratégia na API.");
      }
    } catch (error: any) {
      logger.error(`[${componentInstanceId}] Erro ao excluir estratégia ${strategyId}:`, error);
      setDeleteStrategyError(error.response?.data?.message || error.message || "Ocorreu um erro ao excluir a estratégia.");
    } finally {
      setDeletingStrategyId(null); 
    }
  }, [componentInstanceId, logger]);

  // Função para formatar data (exemplo simples)
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      logger.warn("Erro ao formatar data:", dateString, e);
      return dateString; 
    }
  };

  // Efeito para calcular estatísticas inteligentes sempre que os números mudarem
  useEffect(() => {
    if (filteredNumbers.length > 0) {
      // Extrair apenas os números das RouletteNumber para as funções que esperam number[]
      const numbersList = filteredNumbers.map(item => item.numero);
      
      // Aplicar modelos preditivos
      const predictions = generateNeuralPredictions(numbersList);
      setNeuralPredictions(predictions);
      
      // Calcular números devidos
      const due = calculateDueNumbers(numbersList);
      setDueNumbers(due);
      
      // Calcular padrões temporais
      const patterns = calculateTimePatterns(filteredNumbers);
      setTimePatterns(patterns);
      
      // Calcular momentum
      const momentum = calculateMomentum(numbersList);
      setMomentumData(momentum);
      
      // Detectar anomalias
      const anomaliesFound = detectAnomalies(numbersList);
      setAnomalies(anomaliesFound);
      
      // Calcular matriz de Markov
      const markov = calculateMarkovTransitions(numbersList);
      setMarkovTransitions(markov);
    }
  }, [filteredNumbers]);

  // Renderização dos novos componentes de estatísticas inteligentes
  const renderNeuralPredictions = () => (
    <Card className="bg-card/20 border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <BrainCircuit className="h-4 w-4 mr-2 text-primary" />
          Previsões do Modelo IA
        </CardTitle>
        <CardDescription className="text-xs">
          Probabilidades baseadas em análise de padrões
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-6 gap-1 mb-2">
          {neuralPredictions.slice(0, 6).map(pred => (
            <div key={`pred-${pred.number}`} className="flex flex-col items-center">
              <NumberDisplay number={pred.number} size="tiny" />
              <span className="text-xs font-bold mt-1">{pred.probability}%</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          Confiança do modelo: {neuralPredictions.length > 0 ? 'Média' : 'Insuficiente'}
        </div>
      </CardContent>
    </Card>
  );
  
  const renderDueNumbers = () => (
    <Card className="bg-card/20 border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <TrendingUp className="h-4 w-4 mr-2 text-primary" />
          Regressão à Média
        </CardTitle>
        <CardDescription className="text-xs">
          Números estatisticamente "devidos"
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="grid grid-cols-5 gap-1">
          {dueNumbers.slice(0, 5).map(item => (
            <div 
              key={`due-${item.number}`} 
              className="flex flex-col items-center"
            >
              <NumberDisplay 
                number={item.number} 
                size="tiny" 
                highlight={item.isStatisticallySignificant}
              />
              <span 
                className={`text-xs font-bold mt-1 ${
                  item.isStatisticallySignificant ? "text-amber-500" : "text-muted-foreground"
                }`}
              >
                {(item.dueFactor * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
  
  const renderTimePatterns = () => (
    <Card className="bg-card/20 border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Clock className="h-4 w-4 mr-2 text-primary" />
          Correlações Temporais
        </CardTitle>
        <CardDescription className="text-xs">
          Números favoráveis no horário atual ({timePatterns.currentHour}:00)
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex justify-center gap-2 mb-2">
          {timePatterns.currentHourFavorableNumbers.length > 0 ? (
            timePatterns.currentHourFavorableNumbers.map(item => (
              <div key={`time-${item.number}`} className="flex flex-col items-center">
                <NumberDisplay number={item.number} size="tiny" />
                <span className="text-xs mt-1">{item.frequency}x</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">Dados insuficientes para este horário</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
  
  const renderMomentum = () => (
    <Card className="bg-card/20 border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Flame className="h-4 w-4 mr-2 text-primary" />
          Momentum Estatístico
        </CardTitle>
        <CardDescription className="text-xs">
          Força e direção das tendências atuais
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {momentumData && (
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col items-center p-1 rounded-md bg-card/30">
              <span className="text-xs mb-1">Cor</span>
              <div className={`h-1 w-full rounded-full bg-muted`}>
                <div 
                  className={`h-full rounded-full ${momentumData.color.direction === 'vermelho' ? 'bg-red-500' : 'bg-slate-800'}`}
                  style={{ width: `${momentumData.color.strength * 100}%` }}
                ></div>
              </div>
              <span className="text-xs mt-1 capitalize">{momentumData.color.direction}</span>
            </div>
            
            <div className="flex flex-col items-center p-1 rounded-md bg-card/30">
              <span className="text-xs mb-1">Paridade</span>
              <div className={`h-1 w-full rounded-full bg-muted`}>
                <div 
                  className={`h-full rounded-full bg-amber-500`}
                  style={{ width: `${momentumData.parity.strength * 100}%` }}
                ></div>
              </div>
              <span className="text-xs mt-1 capitalize">{momentumData.parity.direction}</span>
            </div>
            
            <div className="flex flex-col items-center p-1 rounded-md bg-card/30">
              <span className="text-xs mb-1">Alta/Baixa</span>
              <div className={`h-1 w-full rounded-full bg-muted`}>
                <div 
                  className={`h-full rounded-full bg-blue-500`}
                  style={{ width: `${momentumData.highLow.strength * 100}%` }}
                ></div>
              </div>
              <span className="text-xs mt-1 capitalize">{momentumData.highLow.direction}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  const renderAnomalies = () => (
    <Card className="bg-card/20 border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2 text-amber-500" />
          Anomalias Detectadas
        </CardTitle>
        <CardDescription className="text-xs">
          Eventos estatisticamente improváveis
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {anomalies.length > 0 ? (
          <div className="space-y-2">
            {anomalies.slice(0, 3).map((anomaly, idx) => (
              <div key={`anomaly-${idx}`} className="text-xs flex items-start gap-2 p-1 rounded-md bg-card/30">
                <AlertCircle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span>{anomaly.description}</span>
                  <span className={`ml-1 px-1 py-0.5 rounded text-[10px] ${
                    anomaly.severity === 'alta' ? 'bg-red-900/50 text-red-300' : 'bg-amber-900/50 text-amber-300'
                  }`}>
                    {anomaly.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle className="h-3 w-3 text-green-500" />
            Nenhuma anomalia significativa detectada
          </div>
        )}
      </CardContent>
    </Card>
  );
  
  const renderMarkov = () => (
    <Card className="bg-card/20 border-primary/20">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-sm font-medium flex items-center">
          <Grid3X3 className="h-4 w-4 mr-2 text-primary" />
          Matriz de Transição
        </CardTitle>
        <CardDescription className="text-xs">
          Probabilidade do próximo número baseado no atual
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {filteredNumbers.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-center items-center gap-2 mb-1">
              <span className="text-xs">Após</span>
              <NumberDisplay number={filteredNumbers[0].numero} size="tiny" />
              <span className="text-xs">provavelmente virá:</span>
            </div>
            
            <div className="flex justify-center gap-1">
              {markovTransitions
                .filter(t => t.from === filteredNumbers[0].numero)
                .slice(0, 4)
                .map(t => (
                  <div key={`markov-${t.from}-${t.to}`} className="flex flex-col items-center">
                    <NumberDisplay number={t.to} size="tiny" />
                    <span className="text-xs mt-1">{(t.probability * 100).toFixed(0)}%</span>
                  </div>
                ))}
              
              {markovTransitions.filter(t => t.from === filteredNumbers[0].numero).length === 0 && (
                <span className="text-xs text-muted-foreground">Dados insuficientes</span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="w-full h-full fixed right-0 top-0 bg-[#141318] border-l border-[#2a2a2e] overflow-y-auto">
      <div className="p-5 border-b border-gray-800 bg-opacity-40 flex justify-between items-center">
        <div>
          <h2 className="text-white flex items-center text-xl font-bold mb-1">
          <BarChart className="mr-3 text-vegas-green h-6 w-6" /> Estatísticas da {roletaNome}
        </h2>
        <p className="text-sm text-gray-400">
            {isLoading ? "Carregando histórico..." : (historicalNumbers.length === 0 ? "Nenhum histórico disponível." : "")}
          </p>
        </div>
        
        <Dialog open={isStrategyModalOpen} onOpenChange={setIsStrategyModalOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Settings2 className="mr-2 h-4 w-4" /> Gerenciar Estratégias
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] bg-card border-border flex flex-col max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Gerenciar Estratégias</DialogTitle>
              <DialogDescription>
                Crie novas estratégias ou gerencie as existentes.
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="flex-grow pr-6 -mr-6">
              {/* SEÇÃO: CRIAR NOVA ESTRATÉGIA */}
              <div className="grid gap-4 py-4">
                <Label className="text-lg font-semibold text-white">Criar Nova Estratégia</Label>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="strategy-name" className="text-right">Nome</Label>
                  <Input 
                    id="strategy-name" 
                    value={strategyName}
                    onChange={(e) => setStrategyName(e.target.value)}
                    placeholder="Ex: Martingale reverso"
                    className="col-span-3 bg-input border-border"
                  />
                </div>
                
                <Separator className="my-1" />
                <div className="space-y-3">
                  <Label>Condições (Gatilhos)</Label>
                  {strategyConditions.length === 0 && (
                    <p className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-md text-center">
                      Clique em "Adicionar Condição" para começar.
                    </p>
                  )}
                  {strategyConditions.map((condition) => (
                    <div key={condition.id} className="flex items-start space-x-2 p-3 border border-border rounded-md">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Select
                           value={condition.type}
                           onValueChange={(value) => updateCondition(condition.id, 'type', value)}
                        >
                           <SelectTrigger className="bg-input border-border h-9 text-sm"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                           <SelectContent className="bg-card border-border text-white z-[9999]">
                              {conditionTypes.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                           </SelectContent>
                         </Select>
                        <Select
                           value={condition.operator}
                           onValueChange={(value) => updateCondition(condition.id, 'operator', value)}
                           disabled={!condition.type}
                        >
                           <SelectTrigger className="bg-input border-border h-9 text-sm"><SelectValue placeholder="Operador..." /></SelectTrigger>
                           <SelectContent className="bg-card border-border text-white z-[9999]">
                             {!condition.type ? (
                               <SelectItem value="placeholder_no_type_operator" disabled>Selecione um tipo</SelectItem>
                             ) : (operatorsByType[condition.type] || []).length === 0 ? (
                               <SelectItem value="placeholder_no_operators_for_type" disabled>N/A para este tipo</SelectItem>
                             ) : (
                               (operatorsByType[condition.type] || []).map(op => (
                                 <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                               ))
                             )}
                           </SelectContent>
                         </Select>
                         <div className="h-9">
                             <ConditionValueInput
                               conditionType={condition.type || ''}
                               operator={condition.operator || ''}
                               value={condition.value}
                               onChange={(newValue) => updateCondition(condition.id, 'value', newValue)}
                               disabled={!condition.operator || !condition.type}
                             />
                         </div>
                      </div>
                       <Button variant="ghost" size="icon" onClick={() => removeCondition(condition.id)} className="text-muted-foreground hover:text-destructive h-8 w-8 mt-0.5"><Trash2 size={16} /></Button>
                    </div>
                   ))}
                 </div>
                 <Button variant="outline" size="sm" onClick={addCondition} className="mt-2 justify-start"><PlusCircle size={14} className="mr-2" /> Adicionar Condição</Button>
              
                {/* Mensagens de feedback de salvamento de nova estratégia */}
                {saveStrategyError && <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/30 mt-3"><AlertCircle className="inline h-4 w-4 mr-1.5" />{saveStrategyError}</p>}
                {saveStrategySuccess && <p className="text-sm text-green-500 bg-green-500/10 p-3 rounded-md border border-green-500/30 mt-3"><CheckCircle className="inline h-4 w-4 mr-1.5" />{saveStrategySuccess}</p>}
                
                <Button onClick={handleSaveStrategy} disabled={isSavingStrategy} className="mt-2 w-full">
                  {isSavingStrategy ? "Salvando Nova Estratégia..." : "Salvar Nova Estratégia"}
                </Button>
              </div> {/* Fim da seção Criar Nova Estratégia */}

              {/* --- SEÇÃO: ESTRATÉGIAS SALVAS --- */}
              <Separator className="my-6" />
              <div className="space-y-4 pb-4"> {/* Adicionado pb-4 para espaço antes do footer */}
                <Label className="text-lg font-semibold text-white">Estratégias Salvas</Label>
                
                {/* Feedback da listagem e exclusão de estratégias */}
                {fetchStrategiesError && <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/30"><AlertCircle className="inline h-4 w-4 mr-1.5" />{fetchStrategiesError}</p>}
                {deleteStrategySuccess && <p className="text-sm text-green-500 bg-green-500/10 p-3 rounded-md border border-green-500/30"><CheckCircle className="inline h-4 w-4 mr-1.5" />{deleteStrategySuccess}</p>}
                {deleteStrategyError && <p className="text-sm text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/30"><AlertCircle className="inline h-4 w-4 mr-1.5" />{deleteStrategyError}</p>}

                {isLoadingStrategies ? (
                  <div className="space-y-2 py-4">
                    <Skeleton className="h-12 w-full bg-muted/30 rounded-md" />
                    <Skeleton className="h-12 w-full bg-muted/30 rounded-md" />
                  </div>
                ) : !fetchStrategiesError && savedStrategies.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-3 border border-dashed border-border rounded-md text-center">
                    Nenhuma estratégia salva ainda.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                    {savedStrategies.map((strategy) => (
                      <div key={strategy._id} className="flex items-center justify-between p-3 border border-border rounded-md bg-card-foreground/5 hover:bg-card-foreground/10 transition-colors">
                        <div>
                          <p className="font-medium text-white text-sm">{strategy.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Criada em: {formatDate(strategy.createdAt)}
                            {strategy.roletaId && ` (Roleta: ${strategy.roletaId})`}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteStrategy(strategy._id)}
                          disabled={deletingStrategyId === strategy._id}
                          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0" // shrink-0 para não encolher
                          aria-label="Excluir estratégia"
                        >
                          {deletingStrategyId === strategy._id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div> {/* Fim da seção Estratégias Salvas */}
            </ScrollArea>

            <DialogFooter className="mt-auto pt-4 border-t border-border">
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Nova seção de filtros avançados */}
      <div className="space-y-4 p-5 border-b border-gray-800">
        {/* Cabeçalho e botão limpar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-vegas-gold" />
            <h3 className="text-sm font-medium text-white">Filtros de roleta</h3>
          </div>
          
          {hasActiveFilters && (
            <Button 
              onClick={handleClearAllFilters}
              variant="ghost" 
              size="sm"
              className="h-7 px-2 text-xs text-gray-400 hover:text-white"
            >
              <X size={14} className="mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>
        
        {/* Filtros em row com dropdowns */}
        <div className="flex w-full space-x-2 bg-card p-1">
          {/* Filtro por cor */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por cores</div>
            <Select value={selectedColor} onValueChange={handleColorChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="vermelho">
                  <div className="flex items-center">
                    <span className="mr-2 w-2 h-2 rounded-full bg-red-600"></span> Vermelhos
                  </div>
                </SelectItem>
                <SelectItem value="preto">
                  <div className="flex items-center">
                    <span className="mr-2 w-2 h-2 rounded-full bg-gray-900"></span> Pretos
                  </div>
                </SelectItem>
                <SelectItem value="verde">
                  <div className="flex items-center">
                    <span className="mr-2 w-2 h-2 rounded-full bg-green-600"></span> Zero
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por número */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por número</div>
            <Select value={selectedNumber === null ? 'todos' : String(selectedNumber)} onValueChange={handleNumberChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white max-h-[200px] overflow-y-auto">
                {numberOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por paridade */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por paridade</div>
            <Select value={selectedParity} onValueChange={handleParityChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white">
                <SelectItem value="todas">Todas</SelectItem>
                <SelectItem value="par">Pares</SelectItem>
                <SelectItem value="impar">Ímpares</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por provedor */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por provedor</div>
            <Select value={selectedProvider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white max-h-[200px] overflow-y-auto">
                <SelectItem value="todos">Todos</SelectItem>
                {providers.map(provider => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por tempo */}
          <div className="flex-1">
            <div className="text-xs text-gray-400 mb-1 px-2">Por minuto</div>
            <Select value={selectedTime} onValueChange={handleTimeChange}>
              <SelectTrigger className="w-full bg-card border border-border text-white h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-white max-h-[200px] overflow-y-auto">
                {timeOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      {/* <<< NOVA SEÇÃO: Interação com IA >>> */}
      <Card className="m-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center text-white">
            {/* Ícone de IA (exemplo, pode ser outro) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-vegas-gold" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" /></svg>
            Perguntar à IA RunCash sobre {roletaNome}
          </CardTitle>
          <CardDescription className="text-xs">Faça perguntas sobre estatísticas, padrões ou probabilidades desta roleta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={`Ex: Quais os 3 números mais frequentes nos últimos 500 giros desta roleta (${roletaNome})?`}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            rows={3}
            disabled={isAiLoading}
            className="bg-input border-border placeholder:text-muted-foreground/70 text-sm"
          />
          <Button 
            onClick={handleAskAI} 
            disabled={isAiLoading || !aiQuery.trim() || !validRouletteIdentifier}
            size="sm"
            className="w-full bg-vegas-gold hover:bg-vegas-gold/90 text-black"
          >
            {isAiLoading ? "Analisando..." : (!validRouletteIdentifier ? "Selecione uma roleta" : "Enviar Pergunta")}
          </Button>
          
          {/* Área de Resposta / Loading / Erro */}
          <div className="mt-4 p-3 border border-dashed border-border rounded-md min-h-[80px] bg-background/50">
            {isAiLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4 bg-muted/40" />
                <Skeleton className="h-4 w-1/2 bg-muted/40" />
                <Skeleton className="h-4 w-5/6 bg-muted/40" />
              </div>
            )}
            {aiError && (
              <p className="text-sm text-red-500">Erro: {aiError}</p>
            )}
            {aiResponse && !isAiLoading && (
              // Usar um componente para renderizar markdown seria ideal aqui
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
            )}
            {!aiResponse && !isAiLoading && !aiError && (
              <p className="text-xs text-muted-foreground text-center italic">A resposta da IA aparecerá aqui.</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="flex items-center justify-center p-16">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-muted border-t-[hsl(142.1,70.6%,45.3%)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
          {/* Historical Numbers Section */}
          <Card className="md:col-span-2">
            <CardHeader className="p-2 pb-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center">
                  <BarChart className="mr-1 h-4 w-4 text-[hsl(142.1,70.6%,45.3%)]" /> 
                  Histórico de Números
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground">
                  {visibleNumbers.length} de {filteredNumbers.length} números
                </CardDescription>
              </div>
              {visibleNumbersCount < filteredNumbers.length && (
                <Button 
                  onClick={handleShowMore} 
                  variant="ghost" 
                  size="sm"
                  className="h-6 flex items-center gap-1 text-xs border border-border"
                >
                  +{filteredNumbers.length - visibleNumbersCount} <ChevronDown className="h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            
            <CardContent className="p-0 pb-1">
            {visibleNumbers.length > 0 ? (
                <ScrollArea className="h-[300px]">
                  <div className="flex flex-wrap p-3 gap-2">
                    {filteredNumbers.map((n, idx) => (
                      // Formatar o timestamp dentro do JSX
                      <div 
                        key={`${n.numero}-${n.timestamp}-${idx}`} 
                        className="relative cursor-pointer transition-transform hover:scale-110"
                        onClick={() => handleNumberSelection(n.numero)}
                      >
                        <NumberDisplay 
                          number={n.numero} 
                          size="medium" 
                          highlight={highlightedNumber === n.numero}
                        />
                        <div className="text-xs text-gray-400 text-center mt-1">
                          {(() => {
                            // Lógica de formatação movida para cá
                            try {
                                const date = new Date(n.timestamp); 
                                if (!isNaN(date.getTime())) {
                                    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                                }
                            } catch (e) { /* Ignora erro */ }
                            return "--:--"; // Retorna padrão em caso de erro ou data inválida
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Separador e indicações de grupos de números */}
                  <div className="px-3 py-1">
                    <Separator className="my-2" />
                    <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#FF1D46]"></div>
                        <span>Vermelhos: {visibleNumbers.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n.numero)).length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-[#292524]"></div>
                        <span>Pretos: {visibleNumbers.filter(n => n.numero !== 0 && ![1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n.numero)).length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span>Zero: {visibleNumbers.filter(n => n.numero === 0).length}</span>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
            ) : (
                <div className="flex justify-center items-center h-[300px] text-[hsl(215.4,16.3%,56.9%)]">
                  {filteredNumbers.length === 0 && hasActiveFilters ? "Nenhum número corresponde aos filtros." : "Nenhum histórico encontrado."}
                </div>
            )}
            </CardContent>
          </Card>

          {/* Distribution Pie Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ChartBar size={18} className="text-[hsl(142.1,70.6%,45.3%)] mr-2" /> 
                Distribuição por Cor
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              {/* Adicionar legenda de cores na parte superior */}
              <div className="flex justify-center space-x-5 mb-4">
                {pieData.map((entry, index) => (
                  <div key={`color-legend-${index}`} className="flex items-center">
                    <div 
                      className="w-3 h-3 mr-2 rounded-sm" 
                      style={{ backgroundColor: entry.color }}
                    ></div>
                    <span className="text-sm text-[hsl(215.4,16.3%,56.9%)]">{entry.name}</span>
                  </div>
                ))}
              </div>
              <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                      outerRadius={75}
                      innerRadius={45}
                    fill="white"
                    dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="hsl(224,71%,4%)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                        backgroundColor: 'hsl(224,71%,4%/0.95)', 
                        borderColor: 'hsl(142.1,70.6%,45.3%)',
                        borderRadius: '6px',
                        fontSize: '13px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                        padding: '8px 12px'
                    }} 
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            </CardContent>
          </Card>
          
          {/* Roulette Heatmap Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ChartBar size={18} className="text-[hsl(142.1,70.6%,45.3%)] mr-2" /> 
                Mapa de Calor da Roleta
              </CardTitle>
              <CardDescription>
                Distribuição de frequência na roleta
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <style>
                {`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  
                  .roulette-spin {
                    animation: spin 120s linear infinite;
                  }
                  
                  .roulette-spin:hover {
                    animation-play-state: paused;
                  }
                  
                  .pocket {
                    transition: filter 0.3s ease;
                  }
                  
                  .pocket:hover {
                    filter: brightness(1.5) !important;
                    z-index: 10;
                  }
                `}
              </style>
              
              <div className="h-[320px] relative">
                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                  <div className="w-[280px] h-[280px] relative">
                    {/* SVG principal para a roleta e gráfico de frequência */}
                    <svg width="280" height="280" viewBox="0 0 280 280">
                      <defs>
                        <radialGradient id="frequencyGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                          <stop offset="0%" stopColor="#006600" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#006600" stopOpacity="0.3" />
                        </radialGradient>
                      </defs>
                      
                      {/* Grid circular (eixos radiais) */}
                      {Array.from({ length: 12 }).map((_, i) => {
                        const angle = (i * 30) * (Math.PI / 180);
                        const x2 = 140 + 130 * Math.cos(angle);
                        const y2 = 140 + 130 * Math.sin(angle);
                        return (
                          <line 
                            key={`grid-line-${i}`}
                            x1="140" 
                            y1="140" 
                            x2={x2} 
                            y2={y2} 
                            stroke="#888888" 
                            strokeWidth="0.5" 
                            strokeDasharray="2,2"
                            opacity="0.3"
                          />
                        );
                      })}
                      
                      {/* Círculos concêntricos para o grid */}
                      {[25, 50, 75, 100, 125].map((radius, i) => (
                        <circle
                          key={`grid-circle-${i}`}
                          cx="140"
                          cy="140"
                          r={radius * 130 / 130}
                          fill="none"
                          stroke="#888888"
                          strokeWidth="0.5"
                          strokeDasharray="2,2"
                          opacity="0.3"
                        />
                      ))}
                      
                      {/* Renderizar o gráfico de frequência como polígono preenchido */}
                      {(() => {
                        // Calcular valor máximo para normalização
                        const maxValue = Math.max(...rouletteHeatmap.map(item => item.count), 1);
                        const scaleFactor = 110 / maxValue; // 130 é o raio máximo, deixar margem
                        
                        // Calcular pontos do polígono
                        const points = rouletteHeatmap.map((item, index) => {
                          const angle = (index * (360 / ROULETTE_NUMBERS.length)) * (Math.PI / 180);
                          const radius = item.count * scaleFactor;
                          const x = 140 + radius * Math.cos(angle - Math.PI/2); // -90 graus para alinhar
                          const y = 140 + radius * Math.sin(angle - Math.PI/2);
                          return `${x},${y}`;
                        });
                        
                        // Fechar o polígono
                        points.push(points[0]);
                        
                        return (
                          <polygon
                            points={points.join(' ')}
                            fill="url(#frequencyGradient)"
                            stroke="#006600"
                            strokeWidth="1"
                            opacity="0.75"
                          />
                        );
                      })()}
                      
                      {/* Anel externo com cores da roleta */}
                      {ROULETTE_NUMBERS.map((num, index) => {
                        const segmentAngle = 360 / ROULETTE_NUMBERS.length;
                        const startAngle = index * segmentAngle - 90; // -90 para alinhar com o topo
                        const endAngle = (index + 1) * segmentAngle - 90;
                        
                        // Converter para radianos
                        const startRad = (startAngle) * (Math.PI / 180);
                        const endRad = (endAngle) * (Math.PI / 180);
                        
                        // Determinar a cor (alternando entre vermelho e preto, zero é verde)
                        let color = "hsl(220,14%,20%)"; // Preto (padrão)
                        if (num === 0) {
                          color = "hsl(142.1,70.6%,45.3%)"; // Verde para zero
                        } else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
                          color = "hsl(0,72.2%,50.6%)"; // Vermelho
                        }
                        
                        // Calcular pontos do arco externo
                        const outerRadius = 130;
                        const innerRadius = 110;
                        const x1 = 140 + outerRadius * Math.cos(startRad);
                        const y1 = 140 + outerRadius * Math.sin(startRad);
                        const x2 = 140 + outerRadius * Math.cos(endRad);
                        const y2 = 140 + outerRadius * Math.sin(endRad);
                        const x3 = 140 + innerRadius * Math.cos(endRad);
                        const y3 = 140 + innerRadius * Math.sin(endRad);
                        const x4 = 140 + innerRadius * Math.cos(startRad);
                        const y4 = 140 + innerRadius * Math.sin(startRad);
                        
                        // Calcular a posição do texto do número
                        const midAngle = (startAngle + endAngle) / 2;
                        const midRad = midAngle * (Math.PI / 180);
                        const textRadius = 120;
                        const textX = 140 + textRadius * Math.cos(midRad);
                        const textY = 140 + textRadius * Math.sin(midRad);
                        
                        return (
                          <g key={`roulette-segment-${num}`}>
                            {/* Segmento da roleta */}
                            <path
                              d={`M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${innerRadius} ${innerRadius} 0 0 0 ${x4} ${y4} Z`}
                              fill={color}
                              stroke="#333"
                              strokeWidth="0.5"
                            />
                            
                            {/* Número rotacionado */}
                            <g transform={`translate(${textX}, ${textY}) rotate(${midAngle + 90})`}>
                              <text
                                x="0"
                                y="0"
                      fill="white"
                                fontSize="10"
                                fontWeight="bold"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{ 
                                  textShadow: '0px 1px 1px rgba(0,0,0,0.7)',
                                  pointerEvents: 'none'
                                }}
                              >
                                {num}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                      
                      {/* Círculos interno e externo (bordas) */}
                      <circle cx="140" cy="140" r="110" fill="none" stroke="black" strokeWidth="2" />
                      <circle cx="140" cy="140" r="130" fill="none" stroke="black" strokeWidth="2" />
                      
                      {/* Círculo principal para o centro */}
                      <circle 
                        cx="140" 
                        cy="140" 
                        r="40" 
                        fill="#1a1a1a" 
                        stroke="#333" 
                        strokeWidth="1"
                      />
                      
                      {/* Texto no centro */}
                      <text
                        x="140"
                        y="140"
                        fill="#00c853"
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        Roleta
                      </text>
                      
                      {/* Marcador de escala y para valores de frequência */}
                      <g transform="translate(20, 140)">
                        {[0, 25, 50, 75, 100, 125].map((value, i) => (
                          <g key={`y-label-${i}`}>
                            <line 
                              x1="-5" 
                              y1={-value * 130 / 130} 
                              x2="0" 
                              y2={-value * 130 / 130} 
                              stroke="#888" 
                              strokeWidth="1" 
                            />
                            <text
                              x="-8"
                              y={-value * 130 / 130}
                              fill="#888"
                              fontSize="8"
                              textAnchor="end"
                              dominantBaseline="middle"
                            >
                              {value}
                            </text>
                          </g>
                        ))}
                      </g>
                    </svg>
                    
                    {/* Indicador de número no topo */}
                    <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1 w-2 h-8 z-10">
                      <div className="w-full h-full flex flex-col items-center">
                        <div className="w-2 h-6 bg-white"></div>
                        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-t-white border-l-transparent border-r-transparent"></div>
                      </div>
                    </div>
                  </div>
            </div>
          </div>
              
              {/* Legenda de estatísticas */}
              <div className="mt-4 text-center text-sm text-gray-400">
                <p>O gráfico mostra a frequência de cada número (área verde), com o máximo em {rouletteHeatmap.reduce((a, b) => a.count > b.count ? a : b).count} ocorrências.</p>
              </div>
              
              {/* Legenda de regiões */}
              <div className="mt-8 grid grid-cols-2 gap-3">
                {rouletteRegionData.map((region, index) => (
                  <div key={`region-${index}`} className="flex items-center bg-gradient-to-r from-transparent to-[hsla(224,71%,8%,0.4)] rounded p-2">
                    <div className="w-4 h-4 mr-2 rounded-full" 
                         style={{ 
                           background: `radial-gradient(circle at center, hsl(142.1,70.6%,${45 + (region.percentage / 2)}%) 0%, hsl(142.1,70.6%,25%) 100%)`,
                           boxShadow: `0 0 ${5 + (region.percentage / 15)}px hsl(142.1,70.6%,45.3%)`
                         }}></div>
                    <div>
                      <span className="text-xs font-medium text-[hsl(213,31%,91%)]">
                        {region.name}
                      </span>
                      <div className="text-[10px] text-[hsl(215.4,16.3%,66.9%)]">
                        {region.count} números ({region.percentage.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          
          {/* Hot and Cold Numbers Section */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center">
                <ChartBar size={18} className="text-[hsl(142.1,70.6%,45.3%)] mr-2" /> 
                Números Quentes e Frios
              </CardTitle>
            </CardHeader>
            
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {hot.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105 cursor-pointer"
                    onClick={() => handleNumberSelection(item.number)}
                  >
                    <div className="relative">
                      <NumberDisplay 
                        number={item.number} 
                        size="medium" 
                        highlight={highlightedNumber === item.number}
                      />
                    </div>
                    <Badge variant="secondary" className="text-[hsl(142.1,70.6%,45.3%)]">
                      {item.frequency}x
                    </Badge>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-3">
                {cold.map((item, i) => (
                  <div 
                    key={i} 
                    className="flex items-center space-x-2 group transition-transform duration-200 hover:scale-105 cursor-pointer"
                    onClick={() => handleNumberSelection(item.number)}
                  >
                    <div className="relative">
                      <NumberDisplay 
                        number={item.number} 
                        size="medium" 
                        highlight={highlightedNumber === item.number}
                      />
                    </div>
                    <Badge variant="secondary" className="text-[hsl(142.1,70.6%,45.3%)]">
                      {item.frequency}x
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Adicionar a nova seção de Estatísticas Inteligentes */}
      <div className="px-4 py-2 border-t border-gray-800 bg-opacity-40 mt-4">
        <h2 className="text-white flex items-center text-base font-bold">
          <BrainCircuit className="mr-2 text-primary h-5 w-5" /> 
          Estatísticas Inteligentes
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4">
        {renderNeuralPredictions()}
        {renderDueNumbers()}
        {renderTimePatterns()}
        {renderMomentum()}
        {renderAnomalies()}
        {renderMarkov()}
      </div>
    </div>
  );
};

export default RouletteSidePanelStats;