import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardDescription, CardFooter, 
  CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import NumberDisplay from './NumberDisplay';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { useRouletteSettingsStore } from '../stores/rouletteSettingsStore';
import { processRouletteData, getNumberColor } from '../utils/rouletteUtils';
import { RouletteCardProps, ProcessedRouletteData } from '../types/roulette';

// Logging para debug controlado por variável de ambiente
const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log('[DEBUG-RouletteCard]', ...args);
  }
};

// Obter uma única instância do UnifiedClient para reutilização global
const unifiedClient = UnifiedRouletteClient.getInstance();

// Manter um registro global de callbacks para evitar duplicação
const callbackRegistry = new Map<string, {callback: Function, componentId: string}>();

// Criar um contexto global para gerenciar o estado de carregamento
const loadingTimeoutActive = new Set<string>();

// Função auxiliar para obter histórico por nome (fallback caso o método não exista)
const getRouletteHistoryByName = (name: string): any[] => {
  try {
    // Tentar usar o método dedicado se existir
    if (typeof unifiedClient.getPreloadedHistory === 'function') {
      return unifiedClient.getPreloadedHistory(name);
    }
    
    // Fallback: buscar manualmente no histórico
    const allRoulettes = unifiedClient.getAllRoulettes();
    const roulette = allRoulettes.find(r => 
      (r.nome === name || r.name === name || r.roleta_nome === name)
    );
    
    if (roulette && roulette.id) {
      return unifiedClient.getRouletteHistory(roulette.id) || [];
    }
    
    return [];
  } catch (error) {
    console.error('Erro ao buscar histórico por nome:', name, error);
    return [];
  }
};

const RouletteCard: React.FC<RouletteCardProps> = ({ data: initialData, isDetailView = false, onSelect, isSelected }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(() => {
    // Usar função no useState para processar apenas uma vez na montagem inicial
    const processedInitial = processRouletteData(initialData);
    debugLog(`Estado inicial definido com:`, processedInitial);
    return processedInitial;
  });
  const [isLoading, setIsLoading] = useState(!rouletteData);
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
  
  // Criar callbacks memoizados para evitar recriações
  const handleUpdate = useCallback((updateData: any) => {
    debugLog(`handleUpdate chamado para ID: ${safeData.id}`);
    
    // Extrair dados da roleta do objeto de evento
    let myData: any = null;
    
    // Verificar se os dados já são um objeto de roleta para este ID
    if (updateData && typeof updateData === 'object') {
      // Verificar se é a nossa roleta
      if (updateData.id === safeData.id || updateData.roleta_id === safeData.id) {
        myData = updateData;
      }
      // É um array ou contém um array de roletas
      else {
        const rouletteArray = Array.isArray(updateData) 
          ? updateData 
          : (updateData.roulettes || updateData.data || []);
          
        if (Array.isArray(rouletteArray)) {
          myData = rouletteArray.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        }
      }
    }
    
    if (myData) {
      debugLog(`Dados encontrados para ID: ${safeData.id}`);
      const processed = processRouletteData(myData);
      if (processed) {
        setRouletteData(processed);
        setIsLoading(false);
        setError(null);
        setLoadingTimeout(false);
        loadingTimeoutActive.delete(safeData.id);
      }
    }
  }, [safeData.id]);
  
  const historyReadyHandler = useCallback((allHistory: Map<string, any[]>) => {
    // Verificar se temos dados para esta roleta
    const historicalData = getRouletteHistoryByName(safeData.name);
    
    if (historicalData && historicalData.length > 0) {
      debugLog(`Histórico encontrado para: ${safeData.name}`);
        
      // Criar objeto sintético
      const syntheticRoulette = {
        id: safeData.id,
        roleta_id: safeData.id,
        nome: safeData.name,
        roleta_nome: safeData.name,
        provider: "Desconhecido",
        status: "offline",
        numeros: historicalData.slice(0, 10),
        ultimoNumero: historicalData[0]?.numero,
        timestamp: Date.now(),
        isHistorical: true
      };
        
      handleUpdate(syntheticRoulette);
    }
  }, [safeData.id, safeData.name, handleUpdate]);
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    debugLog(`useEffect executado. ID: ${safeData.id}`);

    // Adicionar um timeout de segurança para sempre mostrar algo ao usuário
    // Verificar se já existe um timeout global ativo para este ID
    if (!loadingTimeoutActive.has(safeData.id)) {
      loadingTimeoutActive.add(safeData.id);
      
      const displayTimeoutMs = 5000; // 5 segundos
      const safetyTimeoutId = setTimeout(() => {
        if (isLoading) {
          console.log('Timeout de segurança acionado - liberando interface');
          setLoadingTimeout(true);
          
          // Após mais 3 segundos, liberar o componente mesmo sem dados
          setTimeout(() => {
            setIsLoading(false);
            loadingTimeoutActive.delete(safeData.id);
          }, 3000);
        } else {
          loadingTimeoutActive.delete(safeData.id);
        }
      }, displayTimeoutMs);
      
      timeoutRef.current = safetyTimeoutId;
    }

    // Busca inicial usando dados em cache sempre que possível
    debugLog(`Verificando dados em cache para ID: ${safeData.id}`);
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    
    if (currentDataFromClient) {
      debugLog(`Dados em cache encontrados para ID: ${safeData.id}`);
      handleUpdate(currentDataFromClient);
      setIsLoading(false);
    } else {
      // Tentar usar o histórico como fallback
      const historicalData = getRouletteHistoryByName(safeData.name);
        
      if (historicalData && historicalData.length > 0) {
        debugLog(`Histórico encontrado para: ${safeData.name}`);
          
        // Criar objeto sintético
        const syntheticRoulette = {
          id: safeData.id,
          roleta_id: safeData.id,
          nome: safeData.name,
          roleta_nome: safeData.name,
          provider: "Desconhecido",
          status: "offline",
          numeros: historicalData.slice(0, 10),
          ultimoNumero: historicalData[0]?.numero,
          timestamp: Date.now(),
          isHistorical: true
        };
          
        handleUpdate(syntheticRoulette);
      } else if (isLoading) {
        // Registrar para ser notificado quando os dados históricos estiverem disponíveis
        
        // Evitar registro duplicado de callbacks usando o Map global
        const historyCallbackId = `historical-data-ready_${safeData.id}`;
        
        if (!callbackRegistry.has(historyCallbackId) || 
            callbackRegistry.get(historyCallbackId)?.componentId !== componentId) {
          // Armazenar callback e ID do componente
          callbackRegistry.set(historyCallbackId, {
            callback: historyReadyHandler,
            componentId
          });
          
          // Registrar no cliente apenas uma vez
          unifiedClient.subscribe('historical-data-ready', historyReadyHandler);
        }
      }
    }
    
    // Evitar registros duplicados de callbacks usando o Map global
    const updateCallbackId = `update_${safeData.id}`;
    
    if (!callbackRegistry.has(updateCallbackId) || 
        callbackRegistry.get(updateCallbackId)?.componentId !== componentId) {
      // Armazenar callback e ID do componente
      callbackRegistry.set(updateCallbackId, {
        callback: handleUpdate,
        componentId
      });
      
      // Registrar no cliente apenas uma vez
      unifiedClient.subscribe('update', handleUpdate);
    }

    return () => {
      debugLog(`Limpando recursos para ID: ${safeData.id}`);
      
      // Limpar timeout de segurança
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Remover somente os callbacks registrados por este componente específico
      const updateCallbackId = `update_${safeData.id}`;
      const historyCallbackId = `historical-data-ready_${safeData.id}`;
      
      if (callbackRegistry.has(updateCallbackId) && 
          callbackRegistry.get(updateCallbackId)?.componentId === componentId) {
        // Desinscrever do cliente
        unifiedClient.unsubscribe('update', handleUpdate);
        callbackRegistry.delete(updateCallbackId);
      }
      
      if (callbackRegistry.has(historyCallbackId) && 
          callbackRegistry.get(historyCallbackId)?.componentId === componentId) {
        // Desinscrever do cliente
        unifiedClient.unsubscribe('historical-data-ready', historyReadyHandler);
        callbackRegistry.delete(historyCallbackId);
      }
      
      // Limpar o timeout global
      loadingTimeoutActive.delete(safeData.id);
    };
  }, [safeData.id, safeData.name, isLoading, componentId, handleUpdate, historyReadyHandler]);
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    if (!rouletteData) return '';
    const seconds = Math.floor((Date.now() - rouletteData.lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };

  // Renderização de estado de carregamento
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

  // Renderização de estado de erro
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

  // Renderização quando não há dados
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
        onClick={() => onSelect && onSelect(rouletteData.id)}
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
                }}
              >
                Reconectar
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="py-4 px-[0.20rem] relative z-10">
          {/* Números recentes */}
          <div className="flex flex-wrap justify-center items-center gap-1 min-h-[40px] p-1">
            {lastNumbersToDisplay.map((num, index) => (
              <NumberDisplay 
                key={`${componentId}-num-${index}-${num}`} 
                number={num} 
                size="tiny" 
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

export default React.memo(RouletteCard);