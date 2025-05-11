import { Loader2 } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  data: any; // Manter any por enquanto ou definir tipo específico
  isDetailView?: boolean;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
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
  isHistorical?: boolean;
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
  const isHistorical = roulette.isHistorical || false; // Flag para indicar se são dados históricos

  const result: ProcessedRouletteData = {
    id: currentId,
    nome: currentName,
    provider: currentProvider,
    status: currentStatus,
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp,
    winRate: winRate,
    streak: streak,
    lastUpdateTime: finalUpdateTime,
    isHistorical: isHistorical
  };
  console.log(`[processRouletteData - ${rouletteIdForLog}] Objeto final retornado...`);
  return result;
};

const RouletteCard: React.FC<RouletteCardProps> = ({ data: initialData, isDetailView = false, onSelect, isSelected }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(() => {
       // Usar função no useState para processar apenas uma vez na montagem inicial
       const processedInitial = processRouletteData(initialData);
       console.log(`[RouletteCard - ${initialData?.id}] Estado inicial definido com:`, processedInitial); // Log 5: Estado inicial
       return processedInitial;
  });
  const [isLoading, setIsLoading] = useState(!rouletteData); // Correto: true se não houver dados iniciais
  const [error, setError] = useState<string | null>(null);
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [updateCount, setUpdateCount] = useState(0);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Hooks
  const navigate = useNavigate();
  const { enableSound, enableNotifications } = useRouletteSettingsStore();
  
  // Dados iniciais seguros
  const safeData = useMemo(() => ({
    id: initialData?.id || initialData?._id || 'unknown',
    name: initialData?.name || initialData?.nome || 'Roleta sem nome',
  }), [initialData]);
  
  // ID único para este componente
  const componentId = useRef(`roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`).current;
  
  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    const componentId = `roulette-${safeData.id}-${Math.random().toString(36).substring(2, 9)}`; 
    console.log(`[${componentId}] useEffect executado. ID: ${safeData.id}`);

    const handleUpdate = (updateData: any) => {
        console.log(`[${componentId}] handleUpdate chamado. Evento 'update' recebido`);
        
        // Extrair dados da roleta do objeto de evento
        let myData: any = null;
        
        // Casos possíveis de formato do updateData
        if (updateData && typeof updateData === 'object') {
            // Caso 1: updateData é o objeto { roulettes: [...] }
            if (updateData.roulettes && Array.isArray(updateData.roulettes)) {
                console.log(`[${componentId}] Formato detectado: {roulettes: [...]}. Buscando ID ${safeData.id}`);
                myData = updateData.roulettes.find((r: any) => 
                    (r.id === safeData.id || r.roleta_id === safeData.id)
                );
            } 
            // Caso 2: updateData é um array de roletas diretamente
            else if (Array.isArray(updateData)) {
                console.log(`[${componentId}] Formato detectado: Array direto. Buscando ID ${safeData.id}`);
                myData = updateData.find((r: any) => 
                    (r.id === safeData.id || r.roleta_id === safeData.id)
                );
            }
            // Caso 3: updateData é uma roleta individual
            else if (updateData.id === safeData.id || updateData.roleta_id === safeData.id) {
                console.log(`[${componentId}] Formato detectado: Objeto individual. ID corresponde a ${safeData.id}`);
                myData = updateData;
            }
            // Caso 4: updateData.data contém as roletas (formato do evento SSE)
            else if (updateData.type === 'all_roulettes_update' && Array.isArray(updateData.data)) {
                console.log(`[${componentId}] Formato detectado: {type: 'all_roulettes_update', data: [...]}. Buscando ID ${safeData.id}`);
                myData = updateData.data.find((r: any) => 
                    (r.id === safeData.id || r.roleta_id === safeData.id)
                );
            }
        }
        
        if (myData) {
            console.log(`[${componentId}] Dados para este ID encontrados na atualização!`);
            const processed = processRouletteData(myData);
            if (processed) {
                setRouletteData(processed);
                setIsLoading(false);
                setError(null);
            }
        } else {
            console.log(`[${componentId}] Nenhum dado para ID ${safeData.id} encontrado na atualização.`);
        }
    };

    // Busca inicial e assinatura
    console.log(`[${componentId}] Verificando dados existentes no UnifiedClient...`);
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
         console.log(`[${componentId}] Dados INICIAIS encontrados no UnifiedClient. Processando...`);
         // Chama handleUpdate diretamente para processar os dados iniciais
         handleUpdate(currentDataFromClient); 
         // Define isLoading como false aqui, pois já temos dados
         setIsLoading(false); 
      } else {
        console.log(`[${componentId}] Nenhum dado inicial no UnifiedClient. Tentando usar histórico...`);
        
        // Tentar usar o histórico como fallback
        const historicalData = unifiedClient.getPreloadedHistory(safeData.name);
        
        if (historicalData && historicalData.length > 0) {
          console.log(`[${componentId}] Histórico encontrado com ${historicalData.length} registros para ${safeData.name}`);
          
          // Criar objeto de roleta sintético usando dados históricos
          const syntheticRoulette = {
            id: safeData.id,
            roleta_id: safeData.id,
            nome: safeData.name,
            roleta_nome: safeData.name,
            provider: "Desconhecido",
            status: "offline",
            numeros: historicalData.slice(0, 10), // Primeiros 10 números do histórico
            ultimoNumero: historicalData[0]?.numero,
            timestamp: Date.now(),
            isHistorical: true // Marcar que são dados históricos
          };
          
          console.log(`[${componentId}] Objeto sintético criado a partir do histórico:`, syntheticRoulette);
          handleUpdate(syntheticRoulette);
        } else {
          console.log(`[${componentId}] Nenhum histórico encontrado para ${safeData.name}. Aguardando evento 'update'...`);
          // Mantém isLoading true apenas se não houver dados iniciais
          setIsLoading(true);
        }
      }

    console.log(`[${componentId}] Assinando evento 'update' do UnifiedClient.`);
    unifiedClient.subscribe('update', handleUpdate);

    return () => {
        console.log(`[${componentId}] Desmontando e cancelando assinatura do evento 'update'.`);
        unifiedClient.unsubscribe('update', handleUpdate);
    };
  // Dependências revisadas: safeData.id e unifiedClient são suficientes para setup/cleanup.
  }, [safeData.id, unifiedClient]);
  
  // Adicionar um comentário para garantir que este é o único lugar fazendo requisições:
  // Console.log para verificar se há apenas uma fonte de requisições:
  console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas UnifiedRouletteClient para obter dados da API.');
  
  // Função para abrir detalhes da roleta
  const handleCardClick = () => {
    console.log('Clique no card detectado, mas delegando ao componente pai');
  };
  
  // Função para mostrar estatísticas - removida
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    const seconds = Math.floor((Date.now() - rouletteData.lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };
  
  // Determinar a cor do número
  const getNumberColor = (num: number): string => {
    if (num === 0) return 'verde';
    
    // Números vermelhos na roleta europeia
    const numerosVermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    return numerosVermelhos.includes(num) ? 'vermelho' : 'preto';
  };

  // Log para verificar o estado antes de renderizar
  console.log(`[${componentId}] Renderizando. Estado rouletteData:`, rouletteData); // Log 7: Estado na renderização

  if (isLoading) {
    return (
      <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden bg-card text-card-foreground animate-pulse">
        <CardHeader className="p-4">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mt-1"></div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-center items-center space-x-2">
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
            <div className="h-8 w-8 bg-muted rounded-full"></div>
          </div>
          <div className="h-4 bg-muted rounded w-full"></div>
        </CardContent>
        <CardFooter className="p-4 bg-muted/50 flex justify-between items-center">
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-4 bg-muted rounded w-1/3"></div>
        </CardFooter>
      </Card>
    );
  }

  if (error) {
    return (
        <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden border-destructive bg-destructive/10 text-destructive-foreground">
           <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Erro</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent className="p-4">
                <p className="text-xs">{error}</p>
                <Button variant="link" size="sm" className="mt-2 text-xs p-0 h-auto" onClick={() => unifiedClient.forceUpdate()}>Tentar novamente</Button>
            </CardContent>
        </Card>
    );
  }

  if (!rouletteData) {
    return (
        <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden border-muted bg-muted/10 text-muted-foreground">
           <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sem Dados</CardTitle>
                <Info className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-4">
                <p className="text-xs">Ainda não há dados disponíveis para {safeData.name || 'esta roleta'}.</p>
            </CardContent>
        </Card>
    );
  }
  
  // Desestruturação e Renderização Normal
  const { nome, provider, status, ultimoNumero, numeros, winRate, streak, lastUpdateTime } = rouletteData;
  const isOnline = status?.toLowerCase() === 'online';
  console.log(`[${componentId}] Renderizando números:`, numeros); // Log 8: Array de números antes de mapear
  const lastNumbersToDisplay = numeros.map(n => n.numero);

  return (
    <>
      <Card 
        ref={cardRef}
        className={cn(
          "relative h-full w-full transition-all group",
          {
            'border-primary border-2': isSelected,
            'cursor-pointer hover:border-primary hover:shadow-md': !isDetailView,
            'shadow-inner bg-muted/40': isDetailView,
            'animate-shake': isNewNumber,
            'border-amber-300 border-dashed border-2': rouletteData?.isHistorical
          }
        )}
      >
        {rouletteData?.isHistorical && (
          <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-bl">
            Histórico
          </div>
        )}

        {loadingTimeout && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm font-medium">Carregando dados...</span>
          </div>
        )}

        <CardHeader className="p-3 pb-0">
          {rouletteData && <CardTitle className="text-lg font-semibold flex items-center justify-between">
            <span className="truncate">{rouletteData.nome}</span>
            <div className="flex items-center gap-2">
              <Badge variant={rouletteData.status === 'online' ? 'default' : 'destructive'} className={`${rouletteData.status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}`}>
                {rouletteData.status === 'online' ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </CardTitle>}
          <CardDescription className="text-xs flex justify-between items-center mt-1">
            <span className="opacity-70">{rouletteData?.provider || 'Provedor desconhecido'}</span>
            <span className="text-xs flex items-center gap-1">
              {rouletteData && (
                <span>{getTimeAgo()}</span>
              )}
            </span>
          </CardDescription>
          
          {rouletteData && rouletteData.status !== 'online' && (
            <div className="mt-2 flex justify-end">
              <Button 
                size="sm" 
                variant="outline" 
                className="text-xs py-1 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  unifiedClient.forceReconnectStream();
                  console.log(`[${componentId}] Tentando reconectar com o servidor SSE...`);
                }}
              >
                Reconectar
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-4 relative z-10">
          {/* Números recentes */}
          <div className="flex flex-wrap justify-center items-center gap-1 min-h-[40px] p-1">
            {lastNumbersToDisplay.map((num, index) => (
              <NumberDisplay 
                key={`${componentId}-num-${index}-${num}`} 
                number={num} 
                size="medium" 
                highlight={index === 0 && isNewNumber}
              />
            ))}
            {lastNumbersToDisplay.length === 0 && <span className="text-xs text-muted-foreground">Nenhum número recente</span>}
          </div>
        </CardContent>

        <CardFooter className="p-4 bg-muted/50 flex justify-between items-center text-xs text-muted-foreground">
          <span>{provider}</span>
          <Tooltip>
            <TooltipTrigger>
              <span>Atualizado: {new Date(lastUpdateTime).toLocaleTimeString()}</span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{new Date(lastUpdateTime).toLocaleString()}</p>
            </TooltipContent>
          </Tooltip>
        </CardFooter>
      </Card>
    </>
  );
};

export default RouletteCard;