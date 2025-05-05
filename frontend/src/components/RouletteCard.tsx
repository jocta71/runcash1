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
}

// Função para extrair e processar dados da roleta (Adaptar para nova estrutura)
const processRouletteData = (roulette: any): ProcessedRouletteData | null => {
  if (!roulette || !roulette.id) return null;

  // Adaptar para pegar os números da estrutura correta (ex: roulette.numero)
  const numerosComTimestamp: RouletteNumber[] = (Array.isArray(roulette.numero) ? roulette.numero : []).map((item: any) => {
      let timeString = "00:00";
      if (item.timestamp) {
          try {
              const date = new Date(item.timestamp);
              timeString = date.getHours().toString().padStart(2, '0') + ':' +
                           date.getMinutes().toString().padStart(2, '0');
          } catch (e) { /* Ignorar erro de timestamp */ }
      }
      return {
          numero: Number(item.numero),
          timestamp: timeString
      };
  }).filter((n: any) => !isNaN(n.numero) && n.numero >= 0 && n.numero <= 36);

  const ultimoNumero = numerosComTimestamp.length > 0 ? numerosComTimestamp[0].numero : null;
  
  // Calcular winRate e streak (manter lógica existente se aplicável)
  const winRate = roulette.winRate || Math.random() * 100; // Placeholder
  const streak = roulette.streak || Math.floor(Math.random() * 5); // Placeholder

  return {
    id: roulette.id,
    nome: roulette.nome || roulette.name || 'Roleta Desconhecida',
    provider: roulette.provider || 'Desconhecido',
    status: roulette.status || 'offline',
    ultimoNumero: ultimoNumero,
    numeros: numerosComTimestamp.slice(0, 10), // Limitar a 10 para exibição no card
    winRate: winRate,
    streak: streak,
    lastUpdateTime: roulette.timestamp ? new Date(roulette.timestamp).getTime() : Date.now(),
  };
};

const RouletteCard: React.FC<RouletteCardProps> = ({ data: initialData, isDetailView = false, onSelect, isSelected }) => {
  // Estados
  const [rouletteData, setRouletteData] = useState<ProcessedRouletteData | null>(processRouletteData(initialData));
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
  
  // Efeito para iniciar a busca de dados
  useEffect(() => {
    console.log(`[${componentId}] Montando/Atualizando para Roleta ID: ${safeData.id}`);

    const handleUpdate = (updateData: any) => {
        let myData: any = null;
        if (Array.isArray(updateData)) {
            myData = updateData.find(r => r.id === safeData.id);
        } else if (updateData && updateData.id === safeData.id) {
            myData = updateData;
        }

        if (myData) {
            console.log(`[${componentId}] Recebendo atualização para ${safeData.name}`, myData);
            const processed = processRouletteData(myData);
            if (processed) {
                 setRouletteData(currentData => {
                     if (currentData && processed.ultimoNumero !== currentData.ultimoNumero && processed.ultimoNumero !== null) {
                         console.log(`[${componentId}] Novo número detectado: ${processed.ultimoNumero}`);
                         setIsNewNumber(true);
                         setTimeout(() => setIsNewNumber(false), 2000); 
                     }
                     return processed; 
                 });
                 setIsLoading(false);
                 setError(null);
            } else {
                console.error(`[${componentId}] Falha ao processar dados recebidos.`);
                setError('Falha ao processar dados da roleta.');
                setIsLoading(false);
            }
        }
    };

    console.log(`[${componentId}] Verificando dados existentes no UnifiedClient...`);
    const currentDataFromClient = unifiedClient.getRouletteById(safeData.id);
    if (currentDataFromClient) {
        console.log(`[${componentId}] Dados encontrados no cliente`, currentDataFromClient);
        handleUpdate(currentDataFromClient); 
    } else {
        if (!rouletteData) {
            console.log(`[${componentId}] Sem dados iniciais ou no cliente, definindo isLoading.`);
            setIsLoading(true); 
        } else {
             console.log(`[${componentId}] Usando dados iniciais passados via props.`);
             setIsLoading(false); 
        }
    }

    console.log(`[${componentId}] Assinando evento 'update' do UnifiedClient.`);
    const unsubscribe = unifiedClient.on('update', handleUpdate);

    return () => {
      console.log(`[${componentId}] Desmontando e cancelando inscrição 'update'.`);
      unsubscribe();
    };
  }, [safeData.id, unifiedClient]);
  
  // Adicionar um comentário para garantir que este é o único lugar fazendo requisições:
  // Console.log para verificar se há apenas uma fonte de requisições:
  console.log('[VERIFICAÇÃO DE FONTE ÚNICA] O componente RouletteCard usa apenas UnifiedRouletteClient para obter dados da API.');
  
  // Função para abrir detalhes da roleta
  const handleCardClick = () => {
    // Removida a navegação para a página de detalhes
    return; // Não faz nada ao clicar no card
  };
  
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
  
  // Renderização normal do Card com os dados do estado `rouletteData`
  const { nome, provider, status, ultimoNumero, numeros, winRate, streak, lastUpdateTime } = rouletteData;
  const isOnline = status?.toLowerCase() === 'online';
  const lastNumbersToDisplay = numeros.map(n => n.numero);

  return (
    <Card 
      ref={cardRef}
      className={cn(
        "relative overflow-visible transition-all duration-300 backdrop-filter bg-opacity-40 bg-[#131614] border ", 
        "hover:border-vegas-green/50",
        isNewNumber ? "border-vegas-green animate-pulse" : "",
        isDetailView ? "w-full" : "w-full",
        !isOnline ? "opacity-60 grayscale" : ""
      )}
      onClick={handleCardClick}
    >
      {/* Logo de fundo com baixa opacidade e saturação 0 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden rounded-lg">
        <img 
          src="/assets/icon-rabbit.svg" 
          alt="Icon Rabbit" 
          className="w-[95%] h-auto opacity-[0.025] grayscale filter select-none"
          style={{ 
            objectFit: "contain",
            transformOrigin: "center"
          }} 
        />
      </div>
      
      {/* Reprodutor de áudio (invisível) */}
      <audio ref={audioRef} src="/sounds/coin.mp3" preload="auto" />
      
      <CardContent className="p-4 relative z-10">
        {/* Cabeçalho */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-semibold truncate text-white flex items-center">
            <span className="w-2 h-2 rounded-full bg-vegas-green mr-2"></span>
            {safeData.name}
          </h3>
          <div className="flex gap-1 items-center">
            <Badge 
              variant={rouletteData ? "secondary" : "default"} 
              className={`text-xs ${rouletteData ? 'text-vegas-green border border-vegas-green/30' : 'bg-gray-700/50 text-gray-300'}`}
            >
              {rouletteData ? "Online" : "Sem dados"}
            </Badge>
          </div>
        </div>
        
        {/* Números recentes */}
        <div className="flex justify-center items-center space-x-1 min-h-[40px]">
          {lastNumbersToDisplay.slice(0, 5).map((num, index) => (
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
  );
};

export default RouletteCard;