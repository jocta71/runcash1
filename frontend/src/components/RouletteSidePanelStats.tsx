import { ChartBar, BarChart, ChevronDown, Filter, X, PlusCircle, Trash2, Settings2, AlertCircle, CheckCircle, ZapIcon, Eye, History, Zap } from "lucide-react";
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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

// <<< NOVAS INTERFACES PARA MONITORIA DE ESTRATÉGIAS >>>
interface StrategyExecution {
  strategyId: string;
  strategyName: string;
  executionTime: Date;
  conditions: StrategyCondition[];
  result?: 'win' | 'loss' | 'pending';
  numberAfterExecution?: number;
}

interface ActiveStrategy extends SavedStrategy {
  lastTriggered?: Date;
  isActive: boolean;
  executions: StrategyExecution[];
  stats: {
    total: number;
    wins: number;
    losses: number;
    winRate: number;
  }
}

// Mapa de correspondência entre nomes de roletas conhecidos e seus IDs
const rouletteNamesToIds: Record<string, string> = {
  'Roleta Brasileira': '6399e5f8c77080f2a36a4ccc',
  'Roleta Brasileira Exclusiva': '64cc5b7c47428a4d2be4e5c5',
  'Roleta Premiada': '654aa4a36f22e0ea26ba3e12',
  'Diamond Royale': '63b5829ab673b1c0a7c82a14',
  'Roleta Bets 777': '6480c33b4ea9ec9dfa4f4df3',
  'Roleta Slots 777': '648c44b4e1eecd7c67c16fb2',
  'Fortune Tiger': '63b82f84c4bfc767af381f56',
  'Fortune Mouse': '63b83146c4bfc767af381f64',
  'Fortune OX': '63d1a64b1179ac7e55bb5c9f',
  'Mina Coins': '63b830b7c4bfc767af381f60',
  'Money Bonus': '63b83197c4bfc767af381f68',
  'Fortune Rabbit': '64058a95a5fc69a2c4e5f3b2',
  'Fortune Pig': '6414a39c90f62ab13d8cdb1d',
};

// Função para tentar derivar o ID da roleta baseado no nome
const deriveRouletteIdFromName = (name: string): string => {
  // Normaliza o nome (remove acentos, espaços extras, e coloca em lowercase)
  const normalizedName = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  
  for (const [knownName, id] of Object.entries(rouletteNamesToIds)) {
    const normalizedKnownName = knownName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    
    // Verifica se o nome normalizado contém ou é similar ao nome conhecido
    if (normalizedName.includes(normalizedKnownName) || normalizedKnownName.includes(normalizedName)) {
      logger.info(`Identificado ID ${id} para roleta "${name}" baseado no nome conhecido "${knownName}"`);
      return id;
    }
  }
  
  logger.warn(`Não foi possível identificar o ID para a roleta "${name}"`);
  return '';
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
  const validRouletaId = useMemo(() => {
    const id = roletaId || '';
    
    // Se temos um ID válido, usamos ele
    if (id && id.length > 0 && id !== 'undefined') {
      return id;
    }
    
    // Caso contrário, tentamos derivar do nome da roleta
    if (roletaNome) {
      const derivedId = deriveRouletteIdFromName(roletaNome);
      if (derivedId) {
        logger.info(`Usando ID derivado ${derivedId} para roleta "${roletaNome}"`);
        return derivedId;
      }
    }
    
    // Se não conseguimos derivar, retornamos uma string vazia
    return '';
  }, [roletaId, roletaNome, logger]);
  
  // Função para verificar se o ID da roleta é válido para operações
  const isValidRouletteId = (id: string): boolean => {
    // Verificar se é uma string não vazia
    if (!id || id.length === 0 || id === 'undefined') {
      return false;
    }
    
    // Verificar se é um ID do MongoDB (24 caracteres hexadecimais)
    if (/^[0-9a-f]{24}$/.test(id)) {
      return true;
    }
    
    // Verificar se está no nosso mapa de IDs conhecidos
    return Object.values(rouletteNamesToIds).includes(id);
  };
  
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

  // <<< NOVOS ESTADOS PARA MONITORAMENTO DE ESTRATÉGIAS >>>
  const [activeStrategies, setActiveStrategies] = useState<ActiveStrategy[]>([]);
  const [isMonitoringActive, setIsMonitoringActive] = useState(false);
  const [isStrategyMonitorOpen, setIsStrategyMonitorOpen] = useState(false);

  // Adicionar uma verificação de segurança no início do componente
  useEffect(() => {
    // Adicionar um alerta quando a roleta ID não é válida
    if (!isValidRouletteId(validRouletaId)) {
      logger.warn(`[${componentInstanceId}] ID de roleta inválido: "${validRouletaId}". Algumas funcionalidades podem não funcionar corretamente.`);
    } else {
      logger.info(`[${componentInstanceId}] Usando ID de roleta válido: "${validRouletaId}"`);
    }
  }, [validRouletaId, componentInstanceId, logger, isValidRouletteId]);

  // Esta função será chamada pelo listener do 'update' do UnifiedClient
  const processRouletteUpdate = useCallback((updatedRouletteData: any) => {
    if (!updatedRouletteData || !Array.isArray(updatedRouletteData.numero)) {
        logger.warn('Dados de atualização inválidos recebidos', updatedRouletteData);
        return;
    }

    // Tentar extrair o ID da roleta dos dados recebidos se ainda não temos um ID válido
    if (!isValidRouletteId(validRouletaId) && updatedRouletteData.id) {
      logger.info(`[${componentInstanceId}] Encontrado possível ID de roleta nos dados de atualização: ${updatedRouletteData.id}`);
      // Nota: Não podemos modificar roletaId diretamente pois é uma prop,
      // mas podemos logar isso para que o desenvolvedor saiba que deve atualizar o componente pai
      // para fornecer este ID
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

  }, [roletaNome, componentInstanceId, logger, isValidRouletteId, validRouletaId]);

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
    logger.info(`[${componentInstanceId}] handleAskAI chamada. Query: "${aiQuery}", RoletaID: "${validRouletaId}"`);

    if (!aiQuery.trim() || !isValidRouletteId(validRouletaId)) {
      // Log quando a validação falha
      logger.warn(`[${componentInstanceId}] Validação falhou em handleAskAI. Query válida: ${!!aiQuery.trim()}, RoletaID válida: ${isValidRouletteId(validRouletaId)}. Query: "${aiQuery}", RoletaID: "${validRouletaId}"`);
      setAiError("Por favor, digite sua pergunta e certifique-se que uma roleta está selecionada.");
      return;
    }
    
    logger.info(`[${componentInstanceId}] Enviando pergunta para IA sobre roleta ${validRouletaId}: ${aiQuery}`);
    setIsAiLoading(true);
    setAiResponse(null); // Limpa resposta anterior
    setAiError(null); // Limpa erro anterior

    try {
      const response = await axios.post('/api/ai/query', { 
        query: aiQuery, 
        roletaId: validRouletaId // Usar o ID validado
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
  }, [aiQuery, validRouletaId, componentInstanceId, logger, isValidRouletteId]);

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
    
    // Verificar roletaId
    if (!isValidRouletteId(validRouletaId)) {
      setSaveStrategyError("Não foi possível identificar a roleta atual. Tente novamente mais tarde ou atualize a página.");
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
          
          const response = await axios.post('/api/strategies', {
            name: strategyName,
            conditions: strategyConditions,
            roletaId: validRouletaId // Usar validRouletaId aqui
          }, {
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

  // <<< FUNÇÕES PARA VERIFICAR CONDIÇÕES DAS ESTRATÉGIAS >>>
  const checkColorCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const latestNumber = numbers[0].numero;
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    let actualColor = 'green';
    if (redNumbers.includes(latestNumber)) {
      actualColor = 'red';
    } else if (latestNumber !== 0) {
      actualColor = 'black';
    }
    
    if (condition.operator === 'equals') {
      return actualColor === condition.value;
    } else if (condition.operator === 'not_equals') {
      return actualColor !== condition.value;
    }
    
    return false;
  };

  const checkNumberCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const latestNumber = numbers[0].numero;
    
    if (condition.operator === 'equals') {
      return latestNumber === condition.value;
    } else if (condition.operator === 'not_equals') {
      return latestNumber !== condition.value;
    }
    
    return false;
  };

  const checkParityCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const latestNumber = numbers[0].numero;
    if (latestNumber === 0) return false; // Zero não é par nem ímpar
    
    const isEven = latestNumber % 2 === 0;
    const actualParity = isEven ? 'even' : 'odd';
    
    return actualParity === condition.value;
  };

  const checkDozenCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const latestNumber = numbers[0].numero;
    if (latestNumber === 0) return false;
    
    let actualDozen = '';
    if (latestNumber >= 1 && latestNumber <= 12) {
      actualDozen = '1st';
    } else if (latestNumber >= 13 && latestNumber <= 24) {
      actualDozen = '2nd';
    } else if (latestNumber >= 25 && latestNumber <= 36) {
      actualDozen = '3rd';
    }
    
    if (condition.operator === 'equals') {
      return actualDozen === condition.value;
    } else if (condition.operator === 'not_equals') {
      return actualDozen !== condition.value;
    }
    
    return false;
  };

  const checkColumnCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const latestNumber = numbers[0].numero;
    if (latestNumber === 0) return false;
    
    // Primeira coluna: 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34
    // Segunda coluna: 2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35
    // Terceira coluna: 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36
    const column1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
    const column2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
    const column3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
    
    let actualColumn = '';
    if (column1.includes(latestNumber)) {
      actualColumn = '1st';
    } else if (column2.includes(latestNumber)) {
      actualColumn = '2nd';
    } else if (column3.includes(latestNumber)) {
      actualColumn = '3rd';
    }
    
    if (condition.operator === 'equals') {
      return actualColumn === condition.value;
    } else if (condition.operator === 'not_equals') {
      return actualColumn !== condition.value;
    }
    
    return false;
  };

  const checkHighLowCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const latestNumber = numbers[0].numero;
    if (latestNumber === 0) return false;
    
    const isLow = latestNumber >= 1 && latestNumber <= 18;
    const actualHighLow = isLow ? 'low' : 'high';
    
    return actualHighLow === condition.value;
  };

  const checkColorStreakCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const { color, count } = condition.value || { color: '', count: 0 };
    if (!color || !count || count <= 0) return false;
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    let currentStreak = 0;
    
    for (const number of numbers) {
      let numberColor = '';
      if (number.numero === 0) {
        numberColor = 'green';
      } else if (redNumbers.includes(number.numero)) {
        numberColor = 'red';
      } else {
        numberColor = 'black';
      }
      
      if (numberColor === color) {
        currentStreak++;
      } else {
        break;
      }
    }
    
    if (condition.operator === 'equals') {
      return currentStreak === count;
    } else if (condition.operator === 'greater_equal') {
      return currentStreak >= count;
    }
    
    return false;
  };

  const checkColorMissCondition = (condition: StrategyCondition, numbers: RouletteNumber[]) => {
    if (!numbers.length) return false;
    
    const { color, count } = condition.value || { color: '', count: 0 };
    if (!color || !count || count <= 0) return false;
    
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    let missCount = 0;
    
    for (const number of numbers) {
      let numberColor = '';
      if (number.numero === 0) {
        numberColor = 'green';
      } else if (redNumbers.includes(number.numero)) {
        numberColor = 'red';
      } else {
        numberColor = 'black';
      }
      
      if (numberColor !== color) {
        missCount++;
      } else {
        break;
      }
    }
    
    if (condition.operator === 'equals') {
      return missCount === count;
    } else if (condition.operator === 'greater_equal') {
      return missCount >= count;
    }
    
    return false;
  };

  // <<< FUNÇÃO PRINCIPAL PARA VERIFICAR SE UMA ESTRATÉGIA É ACIONADA >>>
  const evaluateStrategy = (strategy: SavedStrategy, numbers: RouletteNumber[]): boolean => {
    if (!strategy || !strategy.conditions || strategy.conditions.length === 0 || !numbers || numbers.length === 0) {
      return false;
    }
    
    // Todas as condições precisam ser verdadeiras (AND lógico)
    return strategy.conditions.every(condition => {
      switch (condition.type) {
        case 'color':
          return checkColorCondition(condition, numbers);
        case 'number':
          return checkNumberCondition(condition, numbers);
        case 'parity':
          return checkParityCondition(condition, numbers);
        case 'dozen':
          return checkDozenCondition(condition, numbers);
        case 'column':
          return checkColumnCondition(condition, numbers);
        case 'high_low':
          return checkHighLowCondition(condition, numbers);
        case 'streak_color':
          return checkColorStreakCondition(condition, numbers);
        case 'miss_color':
          return checkColorMissCondition(condition, numbers);
        default:
          return false;
      }
    });
  };

  // <<< EFEITO PARA INICIAR/PARAR MONITORAMENTO DE ESTRATÉGIAS >>>
  useEffect(() => {
    if (!isMonitoringActive || !savedStrategies.length || !historicalNumbers.length) {
      return;
    }
    
    // Inicializar strategies que ainda não estão no activeStrategies
    const initializedActiveStrategies = savedStrategies.map(strategy => {
      // Procura se a estratégia já existe no activeStrategies
      const existingActiveStrategy = activeStrategies.find(as => as._id === strategy._id);
      if (existingActiveStrategy) {
        return existingActiveStrategy;
      }
      
      // Se não existir, cria uma nova
      return {
        ...strategy,
        isActive: false,
        executions: [],
        stats: {
          total: 0,
          wins: 0,
          losses: 0,
          winRate: 0
        }
      };
    });
    
    setActiveStrategies(initializedActiveStrategies);
    
    // Verificar cada estratégia contra o último número da roleta
    initializedActiveStrategies.forEach(strategy => {
      const isTriggered = evaluateStrategy(strategy, historicalNumbers);
      
      if (isTriggered && (!strategy.lastTriggered || 
          (new Date().getTime() - strategy.lastTriggered.getTime() > 10000))) {
        // A estratégia foi acionada e não foi acionada nos últimos 10 segundos
        
        logger.info(`[${componentInstanceId}] Estratégia "${strategy.name}" acionada!`);
        
        // Criar uma nova execução
        const newExecution: StrategyExecution = {
          strategyId: strategy._id,
          strategyName: strategy.name,
          executionTime: new Date(),
          conditions: [...strategy.conditions],
          result: 'pending'
        };
        
        // Atualizar a estratégia
        setActiveStrategies(current => 
          current.map(s => 
            s._id === strategy._id 
              ? { 
                  ...s, 
                  lastTriggered: new Date(),
                  isActive: true,
                  executions: [newExecution, ...s.executions].slice(0, 20) // Limitar a 20 execuções
                } 
              : s
          )
        );
      }
    });
  }, [historicalNumbers, savedStrategies, isMonitoringActive, activeStrategies]);

  // <<< FUNÇÃO PARA DETERMINAR SE UMA ESTRATÉGIA GANHOU OU PERDEU >>>
  const determineStrategyResult = (strategy: SavedStrategy, nextNumber: number): 'win' | 'loss' => {
    // Para determinar se uma estratégia ganhou ou perdeu, precisamos analisar as condições
    // e verificar se o próximo número atende ao que seria uma previsão de sucesso.
    
    if (!strategy.conditions || strategy.conditions.length === 0) {
      return 'loss'; // Se não houver condições, consideramos perda por padrão
    }
    
    // Vamos analisar o tipo de estratégia para determinar o resultado esperado
    // Assumimos que o primeiro tipo de condição define o tipo geral da estratégia
    const primaryCondition = strategy.conditions[0];
    
    // Tabela de números vermelhos na roleta
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    switch (primaryCondition.type) {
      case 'color': {
        // Para condições de cor, consideramos que a estratégia tenta prever a próxima cor
        // Se a condição verificada for "vermelha", esperamos que o próximo número seja vermelho
        
        const expectedColor = primaryCondition.value;
        let actualColor = 'green';
        
        if (nextNumber === 0) {
          actualColor = 'green';
        } else if (redNumbers.includes(nextNumber)) {
          actualColor = 'red';
        } else {
          actualColor = 'black';
        }
        
        // Se o operador for 'equals', esperamos que a cor seja igual
        // Se for 'not_equals', esperamos que seja diferente
        if (primaryCondition.operator === 'equals') {
          return actualColor === expectedColor ? 'win' : 'loss';
        } else {
          return actualColor !== expectedColor ? 'win' : 'loss';
        }
      }
      
      case 'number': {
        // Para condições de número específico, verificamos se o próximo número é o esperado
        return nextNumber === primaryCondition.value ? 'win' : 'loss';
      }
      
      case 'parity': {
        // Para condições de paridade, verificamos se o próximo número tem a paridade esperada
        if (nextNumber === 0) return 'loss'; // Zero não é par nem ímpar
        
        const isEven = nextNumber % 2 === 0;
        const actualParity = isEven ? 'even' : 'odd';
        
        return actualParity === primaryCondition.value ? 'win' : 'loss';
      }
      
      case 'dozen': {
        // Para condições de dúzia
        if (nextNumber === 0) return 'loss';
        
        let actualDozen = '';
        if (nextNumber >= 1 && nextNumber <= 12) {
          actualDozen = '1st';
        } else if (nextNumber >= 13 && nextNumber <= 24) {
          actualDozen = '2nd';
        } else if (nextNumber >= 25 && nextNumber <= 36) {
          actualDozen = '3rd';
        }
        
        if (primaryCondition.operator === 'equals') {
          return actualDozen === primaryCondition.value ? 'win' : 'loss';
        } else {
          return actualDozen !== primaryCondition.value ? 'win' : 'loss';
        }
      }
      
      case 'column': {
        // Para condições de coluna
        if (nextNumber === 0) return 'loss';
        
        const column1 = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
        const column2 = [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35];
        const column3 = [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36];
        
        let actualColumn = '';
        if (column1.includes(nextNumber)) {
          actualColumn = '1st';
        } else if (column2.includes(nextNumber)) {
          actualColumn = '2nd';
        } else if (column3.includes(nextNumber)) {
          actualColumn = '3rd';
        }
        
        if (primaryCondition.operator === 'equals') {
          return actualColumn === primaryCondition.value ? 'win' : 'loss';
        } else {
          return actualColumn !== primaryCondition.value ? 'win' : 'loss';
        }
      }
      
      case 'high_low': {
        // Para condições de alta/baixa
        if (nextNumber === 0) return 'loss';
        
        const isLow = nextNumber >= 1 && nextNumber <= 18;
        const actualHighLow = isLow ? 'low' : 'high';
        
        return actualHighLow === primaryCondition.value ? 'win' : 'loss';
      }
      
      case 'streak_color': {
        // Para sequências de cor, geralmente a estratégia espera que a sequência seja quebrada
        // Logo, a próxima cor deve ser diferente da que está em sequência
        const { color } = primaryCondition.value || { color: '' };
        let nextColor = 'green';
        
        if (nextNumber === 0) {
          nextColor = 'green';
        } else if (redNumbers.includes(nextNumber)) {
          nextColor = 'red';
        } else {
          nextColor = 'black';
        }
        
        // Se a estratégia detectou uma sequência longa de uma cor, é comum apostar
        // na cor oposta para "quebrar" a sequência
        return nextColor !== color ? 'win' : 'loss';
      }
      
      case 'miss_color': {
        // Para "miss" de cor, geralmente a estratégia espera que a cor ausente apareça
        // Logo, a próxima cor deve ser a que está em "miss"
        const { color } = primaryCondition.value || { color: '' };
        let nextColor = 'green';
        
        if (nextNumber === 0) {
          nextColor = 'green';
        } else if (redNumbers.includes(nextNumber)) {
          nextColor = 'red';
        } else {
          nextColor = 'black';
        }
        
        // Se a estratégia detectou ausência longa de uma cor, espera-se que essa cor apareça
        return nextColor === color ? 'win' : 'loss';
      }
      
      default:
        return 'loss';
    }
  };

  // <<< EFEITO PARA ATUALIZAR RESULTADO DAS EXECUÇÕES COM O PRÓXIMO NÚMERO >>>
  useEffect(() => {
    if (!activeStrategies.length || historicalNumbers.length < 2) {
      return;
    }
    
    const updatedStrategies = [...activeStrategies];
    let hasUpdates = false;
    
    updatedStrategies.forEach(strategy => {
      // Verificar execuções pendentes
      strategy.executions.forEach((execution, index) => {
        if (execution.result === 'pending') {
          // Verificar se já temos um número após a execução
          const executionTime = new Date(execution.executionTime).getTime();
          
          // Encontrar o número que veio depois da execução
          const nextNumber = historicalNumbers.find(n => {
            const numberTime = new Date(n.timestamp).getTime();
            return numberTime > executionTime;
          });
          
          if (nextNumber) {
            // Determinar o resultado usando nossa função de análise de estratégia
            const result = determineStrategyResult(strategy, nextNumber.numero);
            
            // Atualizar a execução
            strategy.executions[index].result = result;
            strategy.executions[index].numberAfterExecution = nextNumber.numero;
            
            // Atualizar estatísticas
            strategy.stats.total++;
            if (result === 'win') {
              strategy.stats.wins++;
            } else {
              strategy.stats.losses++;
            }
            strategy.stats.winRate = Math.round((strategy.stats.wins / strategy.stats.total) * 100);
            
            hasUpdates = true;
          }
        }
      });
    });
    
    if (hasUpdates) {
      setActiveStrategies(updatedStrategies);
    }
  }, [historicalNumbers, activeStrategies]);

  // O principal JSX retornado pelo componente
  return (
    <div className="w-full h-full">
      {/* Alerta quando o ID da roleta não é válido */}
      {!isValidRouletteId(validRouletaId) && (
        <Alert variant="default" className="mb-4 animate-fadeIn text-sm rounded-lg border-yellow-500/50 bg-yellow-500/10 text-yellow-500">
          <AlertCircle className="h-4 w-4 mr-2" />
          <AlertTitle className="text-sm font-bold">ID da roleta não identificado</AlertTitle>
          <AlertDescription className="text-xs mt-1">
            Algumas funcionalidades podem não estar disponíveis. Tente recarregar a página ou selecionar outra roleta.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Cabeçalho principal */}
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
             
            {/* Aviso sobre ID de roleta inválido no modal */}
            {!isValidRouletteId(validRouletaId) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mb-4">
                <p className="text-sm text-amber-500 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                  Alerta: ID da roleta não identificado. Algumas funcionalidades não estarão disponíveis. 
                  Tente recarregar a página ou escolher outra roleta.
                </p>
              </div>
            )}
             
            <ScrollArea className="flex-grow pr-6 -mr-6">
              {/* Conteúdo do modal (será adicionado posteriormente) */}
            </ScrollArea>

            <DialogFooter className="mt-auto pt-4 border-t border-border">
              <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Seção de consulta à IA */}
      <Card className="m-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-vegas-gold" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd" />
            </svg>
            Perguntar à IA RunCash sobre {roletaNome}
          </CardTitle>
          <CardDescription className="text-xs">Faça perguntas sobre estatísticas, padrões ou probabilidades desta roleta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Alerta quando o ID da roleta não é válido (específico para a seção de IA) */}
          {!isValidRouletteId(validRouletaId) && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-3 mb-3">
              <p className="text-sm text-amber-500 flex items-start">
                <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
                <span>
                  Não foi possível identificar o ID desta roleta. As consultas à IA estão indisponíveis.
                  <br/>
                  <span className="text-xs mt-1 block">Tente recarregar a página ou escolher outra roleta.</span>
                </span>
              </p>
            </div>
          )}
          <Textarea
            placeholder={`Ex: Quais os 3 números mais frequentes nos últimos 500 giros desta roleta (${roletaNome})?`}
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            rows={3}
            disabled={isAiLoading || !isValidRouletteId(validRouletaId)}
            className="bg-input border-border placeholder:text-muted-foreground/70 text-sm"
          />
          <Button 
            onClick={handleAskAI} 
            disabled={isAiLoading || !aiQuery.trim() || !isValidRouletteId(validRouletaId)}
            size="sm"
            className="w-full bg-vegas-gold hover:bg-vegas-gold/90 text-black"
          >
            {isAiLoading ? "Analisando..." : (!isValidRouletteId(validRouletaId) ? "ID da roleta inválido" : "Enviar Pergunta")}
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
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{aiResponse}</p>
            )}
            {!aiResponse && !isAiLoading && !aiError && (
              <p className="text-xs text-muted-foreground text-center italic">A resposta da IA aparecerá aqui.</p>
            )}
          </div>
        </CardContent>
      </Card>
      
      {/* Conteúdo principal - Continua sendo reconstruído */}
    </div>
  );
};

export default RouletteSidePanelStats;