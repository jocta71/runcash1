import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  
  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // Log para diagnóstico da conexão SSE
  useEffect(() => {
    debugLog(`Diagnosticando conexão SSE:`, unifiedClient.diagnoseConnectionState());
    // Este effect deve ser executado apenas uma vez
  }, [componentId]);
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    debugLog(`useEffect executado. ID: ${safeData.id}`);

    const handleUpdate = (updateData: any) => {
      debugLog(`handleUpdate chamado. Evento 'update' recebido`);
        
      // Extrair dados da roleta do objeto de evento
      let myData: any = null;
        
      // Casos possíveis de formato do updateData
      if (updateData && typeof updateData === 'object') {
        // Caso 1: updateData é o objeto { roulettes: [...] }
        if (updateData.roulettes && Array.isArray(updateData.roulettes)) {
          debugLog(`Formato detectado: {roulettes: [...]}. Buscando ID ${safeData.id}`);
          myData = updateData.roulettes.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        } 
        // Caso 2: updateData é um array de roletas diretamente
        else if (Array.isArray(updateData)) {
          debugLog(`Formato detectado: Array direto. Buscando ID ${safeData.id}`);
          myData = updateData.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        }
        // Caso 3: updateData é uma roleta individual
        else if (updateData.id === safeData.id || updateData.roleta_id === safeData.id) {
          debugLog(`Formato detectado: Objeto individual. ID corresponde a ${safeData.id}`);
          myData = updateData;
        }
        // Caso 4: updateData.data contém as roletas (formato do evento SSE)
        else if (updateData.type === 'all_roulettes_update' && Array.isArray(updateData.data)) {
          debugLog(`Formato detectado: {type: 'all_roulettes_update', data: [...]}. Buscando ID ${safeData.id}`);
          myData = updateData.data.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        }
      }
        
      if (myData) {
        debugLog(`Dados para este ID encontrados na atualização!`);
        const processed = processRouletteData(myData);
        if (processed) {
          setRouletteData(processed);
          setIsLoading(false);
          setError(null);
        }
      } else {
        debugLog(`Nenhum dado para ID ${safeData.id} encontrado na atualização.`);
      }
    };

    // Busca inicial e assinatura
    debugLog(`Verificando dados existentes no UnifiedClient...`);
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
      debugLog(`Dados INICIAIS encontrados no UnifiedClient. Processando...`);
      // Chama handleUpdate diretamente para processar os dados iniciais
      handleUpdate(currentDataFromClient); 
      // Define isLoading como false aqui, pois já temos dados
      setIsLoading(false); 
    } else {
      debugLog(`Nenhum dado inicial no UnifiedClient. Tentando usar histórico...`);
        
      // Tentar usar o histórico como fallback
      const historicalData = unifiedClient.getPreloadedHistory(safeData.name);
        
      if (historicalData && historicalData.length > 0) {
        debugLog(`Histórico encontrado com ${historicalData.length} registros para ${safeData.name}`);
          
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
          
        debugLog(`Objeto sintético criado a partir do histórico:`, syntheticRoulette);
        handleUpdate(syntheticRoulette);
      } else {
        debugLog(`Nenhum histórico encontrado para ${safeData.name}. Aguardando evento 'update'...`);
        // Mantém isLoading true apenas se não houver dados iniciais
        setIsLoading(true);
      }
    }

    debugLog(`Assinando evento 'update' do UnifiedClient.`);
    unifiedClient.subscribe('update', handleUpdate);

    // VERIFICAÇÃO DE FONTE ÚNICA
    console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas UnifiedRouletteClient para obter dados da API.');

    return () => {
      debugLog(`Desmontando e cancelando assinatura do evento 'update'.`);
      unifiedClient.unsubscribe('update', handleUpdate);
    };
  // Dependências revisadas: safeData.id e unifiedClient são suficientes para setup/cleanup.
  }, [safeData.id, unifiedClient]);
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    if (!rouletteData) return '';
    const seconds = Math.floor((Date.now() - rouletteData.lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };

  // Log para verificar o estado antes de renderizar
  debugLog(`Renderizando. Estado rouletteData:`, rouletteData);

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
  debugLog(`Renderizando números:`, numeros);
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
                  debugLog(`Tentando reconectar com o servidor SSE...`);
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
      </Card>
    </>
  );
};

export default RouletteCard;