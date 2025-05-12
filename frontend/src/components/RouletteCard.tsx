import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
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

// Evitar log excessivo em produção
const debugLog = (...args: any[]) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[RouletteCard]', ...args);
  }
};

const RouletteCard: React.FC<RouletteCardProps> = ({ data: initialData, isDetailView = false, onSelect, isSelected }) => {
  // ID único estável para este componente
  const uniqueId = useId();
  
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(() => {
    return processRouletteData(initialData);
  });
  const [isLoading, setIsLoading] = useState(!rouletteData);
  const [error, setError] = useState<string | null>(null);
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  
  // Refs
  const cardRef = useRef<HTMLDivElement | null>(null);
  const handlerRegisteredRef = useRef(false);
  const latestNumberRef = useRef<number | null>(null);
  
  // Hooks
  const navigate = useNavigate();
  const { enableSound } = useRouletteSettingsStore();
  
  // Dados iniciais seguros
  const safeData = useMemo(() => ({
    id: initialData?.id || initialData?._id || 'unknown',
    name: initialData?.name || initialData?.nome || 'Roleta sem nome',
  }), [initialData]);
  
  // Obter instância do UnifiedClient
  const unifiedClient = UnifiedRouletteClient.getInstance();
  
  // Definir o manipulador de atualização de dados
  const handleUpdate = useMemo(() => (updateData: any) => {
    // Pular processamento se o componente foi desmontado
    if (!handlerRegisteredRef.current) return;
      
    // Extrair dados da roleta do objeto de evento
    let myData: any = null;
    
    try {
      // Casos possíveis de formato do updateData
      if (updateData && typeof updateData === 'object') {
        // Caso 1: updateData é o objeto { roulettes: [...] }
        if (updateData.roulettes && Array.isArray(updateData.roulettes)) {
          myData = updateData.roulettes.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        } 
        // Caso 2: updateData é um array de roletas diretamente
        else if (Array.isArray(updateData)) {
          myData = updateData.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        }
        // Caso 3: updateData é uma roleta individual
        else if (updateData.id === safeData.id || updateData.roleta_id === safeData.id) {
          myData = updateData;
        }
        // Caso 4: updateData.data contém as roletas (formato do evento SSE)
        else if (updateData.type === 'all_roulettes_update' && Array.isArray(updateData.data)) {
          myData = updateData.data.find((r: any) => 
            (r.id === safeData.id || r.roleta_id === safeData.id)
          );
        }
      }
        
      if (myData) {
        const processed = processRouletteData(myData);
        if (processed) {
          // Verificar se há um novo número
          if (processed.numeros?.length > 0) {
            const latestNumber = processed.numeros[0].numero;
            if (latestNumberRef.current !== undefined && 
                latestNumberRef.current !== null && 
                latestNumberRef.current !== latestNumber) {
              setIsNewNumber(true);
              setTimeout(() => setIsNewNumber(false), 2000);
            }
            latestNumberRef.current = latestNumber;
          }
          
          setRouletteData(processed);
          setIsLoading(false);
          setError(null);
        }
      }
    } catch (err) {
      console.error('[RouletteCard] Erro ao processar dados:', err);
    }
  }, [safeData.id]);
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    // Evitar registro duplicado de handlers
    if (handlerRegisteredRef.current) return;
    
    handlerRegisteredRef.current = true;
    
    // Busca inicial de dados
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
      handleUpdate(currentDataFromClient); 
      setIsLoading(false); 
    } else {
      // Tentar usar o histórico como fallback
      const historicalData = unifiedClient.getPreloadedHistory(safeData.name);
        
      if (historicalData && historicalData.length > 0) {
        // Criar objeto de roleta sintético usando dados históricos
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
      } else {
        setIsLoading(true);
      }
    }

    // Registrar para atualizações
    unifiedClient.subscribe('update', handleUpdate);

    // Cleanup na desmontagem
    return () => {
      handlerRegisteredRef.current = false;
      unifiedClient.unsubscribe('update', handleUpdate);
    };
  }, [safeData.id, unifiedClient, handleUpdate]);
  
  // Formatar tempo relativo
  const getTimeAgo = () => {
    if (!rouletteData) return '';
    const seconds = Math.floor((Date.now() - rouletteData.lastUpdateTime) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s atrás`;
  };

  // Renderização de estados especiais
  if (isLoading) {
    return (
      <Card className="w-full max-w-sm mx-auto shadow-lg rounded-lg overflow-hidden bg-card text-card-foreground animate-pulse">
        <CardHeader className="p-4">
          <div className="h-6 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mt-1"></div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-center items-center space-x-2">
            {[...Array(5)].map((_, i) => (
              <div key={`skeleton-${i}`} className="h-8 w-8 bg-muted rounded-full"></div>
            ))}
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
  const { nome, provider, status, numeros, lastUpdateTime } = rouletteData;
  const lastNumbersToDisplay = numeros.map(n => n.numero);

  return (
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
        <CardTitle className="text-lg font-semibold flex items-center justify-between">
          <span className="truncate">{nome}</span>
          <div className="flex items-center gap-2">
            <Badge variant={status === 'online' ? 'default' : 'destructive'} className={`${status === 'online' ? 'bg-green-500 hover:bg-green-600' : ''}`}>
              {status === 'online' ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </CardTitle>
        <CardDescription className="text-xs flex justify-between items-center mt-1">
          <span className="opacity-70">{provider || 'Provedor desconhecido'}</span>
          <span className="text-xs flex items-center gap-1">
            <span>{getTimeAgo()}</span>
          </span>
        </CardDescription>
        
        {status !== 'online' && (
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
              key={`${uniqueId}-num-${index}-${num}`} 
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
  );
};

export default RouletteCard;