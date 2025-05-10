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
const DEBUG_ENABLED = false;

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
  if (!roulette) {
    debugLog("Dados de roleta inválidos ou nulos");
    return null;
  }

  const rouletteIdForLog = roulette?.id || roulette?.roleta_id || 'ID Desconhecido';
  const rouletteNameForLog = roulette?.nome || roulette?.name || roulette?.roleta_nome || 'Nome Desconhecido';
  
  if (DEBUG_ENABLED) {
    debugLog(`Iniciando processamento para '${rouletteNameForLog}'. Keys recebidas:`, roulette ? Object.keys(roulette) : 'null');
  }

  if (!roulette || !(roulette.id || roulette.roleta_id)) {
    debugLog(`Dados inválidos ou sem ID.`);
    return null;
  }

  const currentId = roulette.id || roulette.roleta_id || '';
  // Priorizar o nome real da roleta (roleta_nome), apenas construir nome genérico se não existir
  const currentName = roulette.roleta_nome || roulette.nome || roulette.name || `Roleta ${currentId}`;

  // 1. Identificar a fonte primária dos números
  let potentialSources = [
    { key: 'numbers', data: roulette.numbers },
    { key: 'numero', data: roulette.numero },
    { key: 'lastNumbers', data: roulette.lastNumbers }, // Adicionado fallback para lastNumbers
    { key: 'numeros', data: roulette.numeros }, // Adicionado outro fallback comum
  ];

  let sourceArray: any[] = [];
  let sourceKey: string = 'none';
  let itemFormat: 'object_number' | 'object_numero' | 'number' | 'unknown' = 'unknown';

  for (const source of potentialSources) {
    // Verificação segura para source.data
    if (source.data && Array.isArray(source.data) && source.data.length > 0) {
      sourceArray = source.data;
      sourceKey = source.key;
      debugLog(`Usando '${sourceKey}' como fonte de números.`);
      
      // Determinar formato do item dentro do array encontrado
      const firstItem = sourceArray[0];
      if (typeof firstItem === 'object' && firstItem !== null) {
          if (typeof firstItem.number !== 'undefined') {
              itemFormat = 'object_number'; // formato { number: ..., timestamp: ... }
          } else if (typeof firstItem.numero !== 'undefined') {
              itemFormat = 'object_numero'; // formato { numero: ..., timestamp: ... }
          } else {
              itemFormat = 'unknown';
              debugLog(`Array '${sourceKey}' contém objetos, mas sem 'number' ou 'numero'.`);
          }
      } else if (typeof firstItem === 'number') {
          itemFormat = 'number'; // formato [1, 2, 3]
      } else {
           itemFormat = 'unknown';
           debugLog(`Array '${sourceKey}' contém itens de formato não reconhecido:`, typeof firstItem);
      }
      break; // Encontrou uma fonte válida, para a busca
    }
  }

  // Se não encontrou nenhuma fonte, criar array vazio em vez de retornar null
  // para garantir que o componente ainda pode ser renderizado
  if (sourceKey === 'none') {
    debugLog(`Nenhuma fonte de números válida encontrada. Criando array vazio.`);
    sourceArray = [];
    sourceKey = 'empty';
  }

  // 2. Mapear o array fonte para o formato { numero: number, timestamp: string }
  // Tratar com segurança o caso de array vazio
  let numerosComTimestamp: RouletteNumber[] = [];
  
  // Garantir que sourceArray é realmente um array antes de usar map
  if (Array.isArray(sourceArray)) {
    try {
      numerosComTimestamp = sourceArray.map((item: any) => {
        let numero: number | null = null;
        let timestamp: string | null | undefined = null;

        try {
          // Extrair número baseado no formato detectado
          if (itemFormat === 'object_number' && typeof item === 'object' && item) {
              numero = Number(item.number);
              timestamp = item.timestamp;
          } else if (itemFormat === 'object_numero' && typeof item === 'object' && item) {
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
                  }
              } catch (e) {
                  // Silenciar erro de parsing de timestamp
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
        } catch (error) {
          // Retornar número inválido em caso de erro
          return { numero: -1, timestamp: '--:--' };
        }
      })
      // Filtrar números inválidos (incluindo os que não foram extraídos corretamente)
      .filter(n => n && n.numero !== -1 && n.numero >= 0 && n.numero <= 36);
    } catch (error) {
      debugLog(`Erro ao processar números: ${error}`);
      numerosComTimestamp = []; // Em caso de falha total, usar array vazio
    }
  }
  
  // 3. Obter outros dados com fallbacks seguros
  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  const winRate = roulette.winRate !== undefined ? roulette.winRate : 0;
  const streak = roulette.streak !== undefined ? roulette.streak : 0;
  const finalUpdateTime = roulette.lastUpdateTime || roulette.timestamp ? 
    new Date(roulette.lastUpdateTime || roulette.timestamp).getTime() : Date.now();
  const currentProvider = roulette.provider || 'Desconhecido';
  const currentStatus = roulette.status || (numerosComTimestamp.length > 0 ? 'online' : 'offline');

  const result: ProcessedRouletteData = {
    id: currentId,
    nome: currentName,
    provider: currentProvider,
    status: currentStatus,
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp.slice(0, 10), // Limitar a 10 números para performance
    winRate: winRate,
    streak: streak,
    lastUpdateTime: finalUpdateTime,
  };
  
  debugLog(`Objeto final processado com ${numerosComTimestamp.length} números`);
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
  const [data, setData] = useState<ProcessedRouletteData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  
  // Referência para o cliente unificado
  const unifiedClient = useRef<UnifiedRouletteClient>(UnifiedRouletteClient.getInstance());
  const instanceId = useRef<string>(`roulette-card-${Math.random().toString(36).substring(2, 9)}`);
  
  // Processa os dados iniciais para configurar o estado
  useEffect(() => {
    if (!roulette) {
      setError("Dados da roleta não fornecidos");
      setIsLoading(false);
      return;
    }
    
    try {
      const processedData = processRouletteData(roulette);
      if (processedData) {
        setData(processedData);
        setError(null);
      } else {
        setError("Não foi possível processar os dados da roleta");
      }
    } catch (err) {
      setError(`Erro ao processar dados: ${err instanceof Error ? err.message : String(err)}`);
      debugLog("Erro ao processar dados iniciais:", err);
    } finally {
      setIsLoading(false);
    }
  }, [roulette]);
  
  // Configura listener para atualizações
  useEffect(() => {
    if (!roulette) return;
    
    const rouletteId = roulette.id || roulette._id || roulette.roleta_id || '';
    const roletteName = roulette.nome || roulette.name || roulette.roleta_nome || '';
    
    debugLog(`Configurando listener para updates da roleta ${roletteName} (ID: ${rouletteId})`);
    
    // Function to handle updates from the UnifiedClient
    const handleUpdate = (updateData: any) => {
      // Skip if no valid roulette data
      if (!rouletteId && !roletteName) return;
      
      try {
        // Case 1: Update is a single roulette object
        if (updateData && typeof updateData === 'object' && !Array.isArray(updateData)) {
          const updateId = updateData.id || updateData._id || updateData.roleta_id || '';
          const updateName = updateData.nome || updateData.name || updateData.roleta_nome || '';
          
          // Check if this update is for our roulette
          if ((rouletteId && updateId === rouletteId) || 
              (roletteName && updateName.toLowerCase() === roletteName.toLowerCase())) {
            debugLog(`Recebido update para esta roleta:`, updateData);
            const processedUpdate = processRouletteData(updateData);
            if (processedUpdate) {
              setData(processedUpdate);
              setLastUpdate(Date.now());
            }
          }
        } 
        // Case 2: Update is an array of roulettes
        else if (Array.isArray(updateData)) {
          // Find our roulette in the array
          const ourRoulette = updateData.find(item => {
            const itemId = item?.id || item?._id || item?.roleta_id || '';
            const itemName = item?.nome || item?.name || item?.roleta_nome || '';
            
            return (rouletteId && itemId === rouletteId) || 
                  (roletteName && itemName.toLowerCase() === roletteName.toLowerCase());
          });
          
          if (ourRoulette) {
            debugLog(`Encontrada nossa roleta em array de updates:`, ourRoulette);
            const processedUpdate = processRouletteData(ourRoulette);
            if (processedUpdate) {
              setData(processedUpdate);
              setLastUpdate(Date.now());
            }
          }
        }
      } catch (err) {
        debugLog(`Erro ao processar update:`, err);
      }
    };
    
    // Subscribe to updates
    const unsubscribeFromUnified = unifiedClient.current.on('update', handleUpdate);
    
    // Also listen to EventBus for legacy events
    const handleLegacyUpdate = (event: any) => {
      if (!event) return;
      
      const eventRouletteId = event.roleta_id || '';
      const eventRouletteName = event.roleta_nome || '';
      
      // Check if this event is for our roulette
      if ((rouletteId && eventRouletteId === rouletteId) || 
          (roletteName && eventRouletteName.toLowerCase() === roletteName.toLowerCase())) {
        debugLog(`Recebido evento legacy para esta roleta:`, event);
        
        // Convert the event to a roulette object and process it
        const rouletteFromEvent = {
          id: eventRouletteId || rouletteId,
          nome: eventRouletteName || roletteName,
          numero: event.sequencia || event.numero || [],
          timestamp: event.timestamp || new Date().toISOString()
        };
        
        const processedUpdate = processRouletteData(rouletteFromEvent);
        if (processedUpdate) {
          setData(processedUpdate);
          setLastUpdate(Date.now());
        }
      }
    };
    
    // Listen to legacy events
    EventBus.on('roulette:update', handleLegacyUpdate);
    EventBus.on('roulette:numero', handleLegacyUpdate);
    
    // Try to get cached data immediately
    try {
      const cachedData = unifiedClient.current.getRouletteById?.(rouletteId) || 
                         unifiedClient.current.getRouletteByName?.(roletteName);
      if (cachedData) {
        const processedCachedData = processRouletteData(cachedData);
        if (processedCachedData) {
          setData(processedCachedData);
          setLastUpdate(Date.now());
        }
      }
    } catch (err) {
      debugLog('Erro ao buscar dados em cache:', err);
    }
    
    // Cleanup
    return () => {
      unsubscribeFromUnified();
      EventBus.off('roulette:update', handleLegacyUpdate);
      EventBus.off('roulette:numero', handleLegacyUpdate);
      debugLog(`Listener removido para roleta ${roletteName}`);
    };
  }, [roulette]);
  
  // Se não tiver dados processados, mostrar indicador de carregamento
  if (isLoading) {
    return (
      <Card className="w-full h-full min-h-[180px] bg-[#131614] border-gray-800/30 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </Card>
    );
  }
  
  // Se tiver erro, mostrar mensagem
  if (error) {
    return (
      <Card className="w-full h-full min-h-[180px] bg-[#131614] border-gray-800/30 flex flex-col items-center justify-center p-4">
        <AlertTriangle className="h-8 w-8 text-amber-500 mb-2" />
        <p className="text-sm text-gray-400 text-center">Erro ao carregar roleta</p>
      </Card>
    );
  }
  
  // Se não tiver dados, mostrar card vazio
  if (!data) {
    return (
      <Card className="w-full h-full min-h-[180px] bg-[#131614] border-gray-800/30 flex flex-col items-center justify-center p-4">
        <Info className="h-8 w-8 text-blue-500 mb-2" />
        <p className="text-sm text-gray-400 text-center">Roleta sem dados disponíveis</p>
      </Card>
    );
  }

  // Renderizar o card com os dados
  return (
    <Card className="w-full h-full bg-[#131614] border-gray-800/30 transition-all duration-300 hover:border-green-600/30 hover:bg-[#131a14]">
      <CardHeader className="pb-2">
        <RouletteCardTitle data={data} />
      </CardHeader>
      <CardContent className="pb-3">
        <div className="flex flex-wrap gap-1 justify-center mb-3 p-2 rounded-lg border border-gray-700/20 bg-[#131111]">
          {Array.isArray(data.numeros) && data.numeros.slice(0, 8).map((num, idx) => (
            <div 
              key={idx} 
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                ${num.numero === 0 ? 'bg-green-600 text-white' : 
                  num.numero % 2 === 0 ? 'bg-black text-white border border-white/10' : 'bg-red-600 text-white'}`
              }
            >
              {num.numero}
            </div>
          ))}
          {(!data.numeros || data.numeros.length === 0) && (
            <div className="text-xs text-gray-400 py-1">Sem números disponíveis</div>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0">
        <div className="flex justify-between items-center w-full text-xs text-gray-400">
          <span>Atualizado: {new Date(data.lastUpdateTime).toLocaleTimeString()}</span>
        </div>
      </CardFooter>
    </Card>
  );
}

export default RouletteCard;