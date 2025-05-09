import { Loader2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RouletteData } from '@/types';
import NumberDisplay from './NumberDisplay';
import { Badge } from "@/components/ui/badge";
import { useRouletteSettingsStore } from '@/stores/rouletteSettingsStore';
import { cn } from '@/lib/utils';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import EventBus from '../services/EventBus';
import { TrendingUp, Zap, CheckCircle, XCircle, AlertTriangle, Info, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Debug flag - set to false to disable logs in production
const DEBUG_ENABLED = true;

// Helper function for controlled logging
const debugLog = (...args: any[]) => {
  if (DEBUG_ENABLED) {
    console.log('[DEBUG-RouletteCard]', ...args);
  }
};

interface RouletteNumber {
  numero: number;
  timestamp: string;
  cor?: string; // Adicionar cor opcional se vier da API
}

interface RouletteCardProps {
  roulette: any;
}

// Interface para os dados específicos que o Card precisa
interface ProcessedRouletteData {
  id: string;
  nome: string;
  provider: string;
  status: string;
  ultimoNumero: number | null;
  numeros: RouletteNumber[]; // Array de objetos { numero: number, timestamp: string }
  winRate: number;
  streak: number;
  lastUpdateTime: number;
}

// Função processRouletteData GLOBAL
const processRouletteData = (roulette: any): ProcessedRouletteData | null => {
  const rouletteIdForLog = roulette?.id || roulette?.roleta_id || 'ID Desconhecido';
  const rouletteNameForLog = roulette?.nome || roulette?.name || roulette?.roleta_nome || 'Nome Desconhecido';
  // Log inicial simplificado para evitar sobrecarga no console com JSON gigante
  console.log(`[processRouletteData - ${rouletteIdForLog}] Iniciando processamento para '${rouletteNameForLog}'. Keys recebidas:`, roulette ? Object.keys(roulette) : 'null');

  if (!roulette || !(roulette.id || roulette.roleta_id)) {
    console.warn(`[processRouletteData - ${rouletteIdForLog}] Dados inválidos ou sem ID.`);
    return null;
  }

  const currentId = roulette.id || roulette.roleta_id;
  // Priorizar o nome real da roleta (roleta_nome), apenas construir nome genérico se não existir
  const currentName = roulette.roleta_nome || roulette.nome || roulette.name || `Roleta ${currentId}`;

  // 1. Identificar a fonte primária dos números
  let potentialSources = [
    { key: 'numbers', data: roulette.numbers },
    { key: 'numero', data: roulette.numero },
    { key: 'lastNumbers', data: roulette.lastNumbers }, // Adicionado fallback para lastNumbers
  ];

  let sourceArray: any[] = [];
  let sourceKey: string = 'none';
  let itemFormat: 'object_number' | 'object_numero' | 'number' | 'unknown' = 'unknown';

  for (const source of potentialSources) {
    if (Array.isArray(source.data) && source.data.length > 0) {
      sourceArray = source.data;
      sourceKey = source.key;
      console.log(`[processRouletteData - ${rouletteIdForLog}] Usando '${sourceKey}' como fonte de números.`);
      
      // Determinar formato do item dentro do array encontrado
      const firstItem = sourceArray[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
          if (typeof firstItem.number !== 'undefined') {
              itemFormat = 'object_number'; // formato { number: ..., timestamp: ... }
          } else if (typeof firstItem.numero !== 'undefined') {
              itemFormat = 'object_numero'; // formato { numero: ..., timestamp: ... }
    } else {
              itemFormat = 'unknown';
              console.warn(`[processRouletteData - ${rouletteIdForLog}] Array '${sourceKey}' contém objetos, mas sem 'number' ou 'numero'.`);
          }
      } else if (typeof firstItem === 'number') {
          itemFormat = 'number'; // formato [1, 2, 3]
      } else {
           itemFormat = 'unknown';
           console.warn(`[processRouletteData - ${rouletteIdForLog}] Array '${sourceKey}' contém itens de formato não reconhecido:`, typeof firstItem);
      }
      break; // Encontrou uma fonte válida, para a busca
    }
  }

  if (sourceKey === 'none') {
    console.log(`[processRouletteData - ${rouletteIdForLog}] Nenhuma fonte de números ('numbers', 'numero', 'lastNumbers') encontrada ou array vazio.`);
    // Se não achou fonte, retorna null para não sobrescrever dados possivelmente bons
    console.warn(`[processRouletteData - ${rouletteIdForLog}] Retornando null pois nenhuma fonte de números foi encontrada.`);
    return null; 
  }
  console.log(`[processRouletteData - ${rouletteIdForLog}] Fonte: '${sourceKey}', Formato Item: '${itemFormat}', Total Itens: ${sourceArray.length}`);

  // 2. Mapear o array fonte para o formato { numero: number, timestamp: string }
  const numerosComTimestamp: RouletteNumber[] = sourceArray.map((item: any) => {
    let numero: number | null = null;
    let timestamp: string | null | undefined = null;

    // Extrair número baseado no formato detectado
    if (itemFormat === 'object_number' && typeof item === 'object') {
        numero = Number(item.number);
        timestamp = item.timestamp;
    } else if (itemFormat === 'object_numero' && typeof item === 'object') {
        numero = Number(item.numero);
        timestamp = item.timestamp;
    } else if (itemFormat === 'number') {
        numero = Number(item);
        timestamp = roulette.timestamp; // Tenta usar timestamp global para arrays de números simples
    }

    // Fallback/Default para timestamp
    let timeString = "--:--";
    if (timestamp) {
        try {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                 timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            } else {
                // Não loga warning para cada timestamp inválido para não poluir muito
                // console.warn(`[processRouletteData - ${rouletteIdForLog}] Timestamp inválido recebido:`, timestamp);
            }
        } catch (e) {
            // console.error(`[processRouletteData - ${rouletteIdForLog}] Erro ao processar timestamp:`, timestamp, e);
        }
    } else if ((itemFormat === 'object_number' || itemFormat === 'object_numero') && typeof item === 'object' && item?.timestamp) {
         // Fallback se timestamp principal falhou mas existe no item
          try {
             const date = new Date(item.timestamp);
             if (!isNaN(date.getTime())) {
                  timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
             }
         } catch {} 
    }

    const finalNumero = (numero === null || isNaN(numero)) ? -1 : numero;

    return {
      numero: finalNumero,
      timestamp: timeString
    };
  })
  // Filtrar números inválidos (incluindo os que não foram extraídos corretamente)
  .filter(n => n.numero !== -1 && n.numero >= 0 && n.numero <= 36);
  
  // Ordenação removida por enquanto, confiando na ordem da API

  console.log(`[processRouletteData - ${rouletteIdForLog}] Números processados válidos (primeiros 10):`, numerosComTimestamp.slice(0, 10));

  // Adicionar verificação extra: Se após processar, não sobrar nenhum número válido
  // e a fonte original foi encontrada, ainda assim pode ser útil retornar os outros dados.
  // A decisão de retornar null deve ser apenas se a FONTE não foi encontrada.

  // 3. Obter outros dados (sem alterações aqui)
  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  const winRate = roulette.winRate !== undefined ? roulette.winRate : Math.random() * 100; // Usar valor real se existir
  const streak = roulette.streak !== undefined ? roulette.streak : Math.floor(Math.random() * 5); // Usar valor real se existir
  const finalUpdateTime = roulette.lastUpdateTime || roulette.timestamp ? new Date(roulette.lastUpdateTime || roulette.timestamp).getTime() : Date.now();
  const currentProvider = roulette.provider || 'Desconhecido';
  const currentStatus = roulette.status || (numerosComTimestamp.length > 0 ? 'online' : 'offline'); // Inferir status se não vier

  const result: ProcessedRouletteData = {
    id: currentId,
    nome: currentName,
    provider: currentProvider,
    status: currentStatus,
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp.slice(0, 10),
    winRate: winRate,
    streak: streak,
    lastUpdateTime: finalUpdateTime,
  };
  console.log(`[processRouletteData - ${rouletteIdForLog}] Objeto final retornado...`);
  return result;
};

// Renomear o componente para evitar o conflito
const RouletteCardTitle = ({ data }: { data: ProcessedRouletteData }) => (
  <div className="flex items-center gap-2">
    <span className="text-lg font-semibold truncate">{data.nome}</span>
    <Badge variant={data.status === 'online' ? 'default' : 'destructive'} className={`ml-auto ${data.status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}`}>
      {data.status === 'online' ? 'Online' : 'Offline'}
    </Badge>
  </div>
);

export const RouletteCard: React.FC<RouletteCardProps> = ({ roulette }) => {
  const [data, setData] = useState<any>(roulette);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Função auxiliar para normalizar o ID da roleta
  const getRoulettId = (rouletteData: any): string => {
    return rouletteData?.id || rouletteData?.roleta_id || '';
  };

  // Função auxiliar para obter o nome da roleta
  const getRouletteName = (rouletteData: any): string => {
    return rouletteData?.nome || rouletteData?.name || rouletteData?.roleta_nome || 'Roleta sem nome';
  };

  // Função auxiliar para obter os números da roleta
  const getRouletteNumbers = (rouletteData: any): number[] => {
    // Tentar diferentes formatos de dados
    if (Array.isArray(rouletteData?.numeros)) {
      return rouletteData.numeros;
    }
    if (Array.isArray(rouletteData?.numbers)) {
      return rouletteData.numbers;
    }
    if (Array.isArray(rouletteData?.sequencia)) {
      return rouletteData.sequencia;
    }
    return [];
  };

  // Função auxiliar para obter o último número da roleta
  const getLatestNumber = (rouletteData: any): number | null => {
    // Tentar diferentes formatos de dados
    if (rouletteData?.ultimoNumero !== undefined) {
      return rouletteData.ultimoNumero;
    }
    if (rouletteData?.numero !== undefined) {
      return rouletteData.numero;
    }
    if (rouletteData?.lastNumber !== undefined) {
      return rouletteData.lastNumber;
    }
    // Se não encontrar, tentar pegar o primeiro número da sequência
    const numbers = getRouletteNumbers(rouletteData);
    return numbers.length > 0 ? numbers[0] : null;
  };

  useEffect(() => {
    // Garantir que temos os dados iniciais
    if (roulette) {
      setData(roulette);
    }
    
    const unifiedClient = UnifiedRouletteClient.getInstance();
    const rouletteId = getRoulettId(roulette);
    
    // Função para lidar com atualizações de dados
    const handleUpdate = (updateData: any) => {
      // Se for um array, procurar a roleta relevante
      if (Array.isArray(updateData)) {
        const updatedRoulette = updateData.find(
          r => getRoulettId(r) === rouletteId
        );
        
        if (updatedRoulette) {
          setData(updatedRoulette);
          setIsLoading(false);
          setError(null);
        }
      } 
      // Se for um objeto único, verificar se é para esta roleta
      else if (updateData && (getRoulettId(updateData) === rouletteId)) {
        setData(updateData);
        setIsLoading(false);
        setError(null);
      }
    };
    
    // Tentar buscar dados do cache primeiro
    const cachedData = unifiedClient.getRouletteById(rouletteId);
    if (cachedData) {
      setData(cachedData);
    }
    
    // Assinar eventos de atualização do UnifiedClient
    const unsubscribe = unifiedClient.on('update', handleUpdate);
    
    // Assinar eventos do EventBus (legado)
    const handleLegacyUpdate = (event: any) => {
      if (event && event.data) {
        handleUpdate(event.data);
      }
    };
    
    EventBus.on('roulette:data-updated', handleLegacyUpdate);
    
    // Cleanup
    return () => {
      unsubscribe();
      EventBus.off('roulette:data-updated', handleLegacyUpdate);
    };
  }, [roulette]);

  // Renderizar cartão com dados da roleta
  const rouletteId = getRoulettId(data);
  const rouletteName = getRouletteName(data);
  const numbers = getRouletteNumbers(data);
  const latestNumber = getLatestNumber(data);

  // Renderizar indicador de loading, se necessário
  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col animate-pulse">
        <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded-md mb-4"></div>
        <div className="flex space-x-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="w-10 h-10 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
          ))}
        </div>
        <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded-md mt-auto"></div>
      </div>
    );
  }

  // Renderizar mensagem de erro, se necessário
  if (error) {
    return (
      <div className="bg-red-100 dark:bg-red-900 rounded-lg shadow-md p-4">
        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Erro</h3>
        <p className="text-red-600 dark:text-red-300">{error}</p>
      </div>
    );
  }

  // Renderizar cartão normal
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 flex flex-col">
      <Link to={`/roulette/${rouletteId}`} className="block">
        <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">{rouletteName}</h3>
      </Link>
      
      <div className="flex space-x-2 mb-4 overflow-x-auto">
        {numbers.slice(0, 10).map((number, index) => (
          <div 
            key={index} 
            className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold
              ${index === 0 ? 'bg-blue-600 ring-2 ring-blue-300' : 'bg-gray-500'}`}
          >
            {number}
          </div>
        ))}
      </div>
      
      <div className="mt-auto">
        <Link to={`/roulette/${rouletteId}`} className="text-blue-600 dark:text-blue-400 hover:underline">
          Ver estratégias
        </Link>
      </div>
    </div>
  );
};

export default RouletteCard;