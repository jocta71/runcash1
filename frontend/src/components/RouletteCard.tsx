import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, CardContent, CardDescription, CardFooter, 
  CardHeader, CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Loader2, AlertTriangle, Info, ThumbsUp, MessageSquare, Eye, TrendingUp, BarChart, Brain, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import NumberDisplay from './NumberDisplay';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { useRouletteSettingsStore } from '../stores/rouletteSettingsStore';
import { processRouletteData, getNumberColor } from '../utils/rouletteUtils';
import { RouletteCardProps, ProcessedRouletteData } from '../types/roulette';
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Posições dos números na roleta europeia
const ROULETTE_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

// Logging para debug controlado por variável de ambiente
const debugLog = (...args: any[]) => {
  if (import.meta.env.DEV) {
    console.log('[DEBUG-RouletteCard]', ...args);
  }
};

const RouletteCard: React.FC<RouletteCardProps> = ({ 
  data: initialData, 
  isDetailView = false, 
  onSelect, 
  isSelected,
  onAddComment,
  onToggleLike,
  onSetAlert
}) => {
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
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [comment, setComment] = useState("");
  const [showHeatMap, setShowHeatMap] = useState(false);
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
          // Adicionar dados simulados para as novas funcionalidades
          processed.predictabilityScore = Math.floor(Math.random() * 100);
          processed.roulettePersonality = ['Repetitiva', 'Alternante', 'Aleatória', 'Equilibrada'][Math.floor(Math.random() * 4)];
          processed.averageTimeBetweenNumbers = Math.floor(Math.random() * 40) + 20;
          processed.watchers = {
            count: Math.floor(Math.random() * 100) + 5,
            trend: ['increasing', 'decreasing', 'stable'][Math.floor(Math.random() * 3)] as 'increasing' | 'decreasing' | 'stable',
            lastUpdate: Date.now()
          };
          processed.strategyPerformance = [
            { name: 'Martingale', score: Math.floor(Math.random() * 10) + 1, trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable' },
            { name: 'Fibonacci', score: Math.floor(Math.random() * 10) + 1, trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable' },
            { name: "D'Alembert", score: Math.floor(Math.random() * 10) + 1, trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable' }
          ];
          processed.sectorAnalysis = {
            hotSectors: [1, 5, 12, 19, 23, 30],
            coldSectors: [0, 8, 11, 17, 26, 35],
            heatMapData: {} // Simplificado para evitar erros
          };
          // Preencher o heatMapData
          for (let i = 0; i < 37; i++) {
            processed.sectorAnalysis.heatMapData[i] = Math.random();
          }
          processed.comments = processed.comments || [];
          processed.isLikedByUser = processed.isLikedByUser || false;
          
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
  
  const handleAddComment = () => {
    if (comment && rouletteData) {
      onAddComment?.(rouletteData.id, comment);
      // Simulando adição de comentário
      if (rouletteData.comments) {
        setRouletteData({
          ...rouletteData,
          comments: [
            ...rouletteData.comments,
            {
              id: `comment-${Date.now()}`,
              userId: 'current-user',
              username: 'Você',
              text: comment,
              timestamp: Date.now()
            }
          ]
        });
      }
      setComment("");
      setShowCommentDialog(false);
    }
  };
  
  const handleToggleLike = () => {
    if (rouletteData) {
      onToggleLike?.(rouletteData.id);
      // Simulando toggle do like
      setRouletteData({
        ...rouletteData,
        isLikedByUser: !rouletteData.isLikedByUser
      });
    }
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
  const { 
    nome, provider, status, ultimoNumero, numeros, winRate, streak, lastUpdateTime,
    predictabilityScore, watchers, roulettePersonality, strategyPerformance, sectorAnalysis,
    comments, isLikedByUser, averageTimeBetweenNumbers
  } = rouletteData;
  
  const isOnline = status?.toLowerCase() === 'online';
  debugLog(`Renderizando números:`, numeros);
  const lastNumbersToDisplay = numeros.map(n => n.numero);

  return (
    <>
      <Card 
        ref={cardRef}
        className={cn(
          "relative h-full w-full transition-all group overflow-hidden",
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
        {/* Background com a imagem da roleta */}
        {rouletteData?.imageUrl && (
          <div 
            className="absolute inset-0 w-full h-full bg-cover bg-center z-0"
            style={{ backgroundImage: `url(${rouletteData.imageUrl})` }}
          />
        )}
        
        {/* Gradiente que fica transparente em cima e escuro embaixo */}
        <div 
          className="absolute inset-0 w-full h-full z-[1]"
          style={{ 
            background: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.9) 100%)' 
          }}
        />
        
        {rouletteData?.isHistorical && (
          <div className="absolute top-0 right-0 bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded-bl z-10">
            Histórico
          </div>
        )}

        {loadingTimeout && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-sm font-medium">Carregando dados...</span>
          </div>
        )}

        <CardHeader className="p-3 pb-0 relative z-10">
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

        <CardContent className="py-3 px-3 relative z-10">
          {/* Números recentes */}
          <div className="flex flex-wrap justify-center items-center gap-1 min-h-[40px] p-1 mb-2">
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
          
          {/* Score de Previsibilidade */}
          <div className="mb-2">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="flex items-center gap-1">
                <Brain className="h-3 w-3" />
                <span>Previsibilidade</span>
              </span>
              <span className={cn(
                "font-semibold", 
                predictabilityScore && predictabilityScore > 70 ? "text-green-500" : 
                predictabilityScore && predictabilityScore > 40 ? "text-amber-500" : "text-red-500"
              )}>
                {predictabilityScore}%
              </span>
            </div>
            <Progress value={predictabilityScore} className="h-1.5" />
          </div>
          
          {/* Personalidade da Roleta */}
          <div className="flex justify-between items-center text-xs mb-2">
            <span>Comportamento:</span>
            <Badge variant="outline" className="text-xs py-0 px-2">
              {roulettePersonality}
            </Badge>
          </div>
          
          {/* Observadores */}
          <div className="flex justify-between items-center text-xs mb-2">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              <span>Observadores:</span>
            </span>
            <Badge variant="secondary" className={cn(
              "text-xs gap-1 flex items-center",
              watchers?.trend === 'increasing' ? "text-green-500" : 
              watchers?.trend === 'decreasing' ? "text-red-500" : ""
            )}>
              {watchers?.count || 0}
              {watchers?.trend === 'increasing' && <TrendingUp className="h-3 w-3" />}
            </Badge>
          </div>
          
          {/* Estratégia com melhor desempenho */}
          {strategyPerformance && strategyPerformance.length > 0 && (
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="flex items-center gap-1">
                <BarChart className="h-3 w-3" />
                <span>Melhor Estratégia:</span>
              </span>
              <Badge variant="outline" className={cn(
                "text-xs",
                strategyPerformance[0].score > 7 ? "border-green-500 text-green-500" : 
                strategyPerformance[0].score > 4 ? "border-amber-500 text-amber-500" : "border-red-500 text-red-500"
              )}>
                {strategyPerformance.sort((a, b) => b.score - a.score)[0].name} ({strategyPerformance.sort((a, b) => b.score - a.score)[0].score}/10)
              </Badge>
            </div>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-between items-center p-2 mt-auto relative z-10">
          <div className="flex gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLike();
                  }}
                >
                  <ThumbsUp className={cn(
                    "h-4 w-4",
                    isLikedByUser ? "fill-primary text-primary" : ""
                  )} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isLikedByUser ? 'Descurtir' : 'Curtir'} esta roleta</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommentDialog(true);
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  {comments && comments.length > 0 && (
                    <span className="absolute -top-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                      {comments.length}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Comentários</p>
              </TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowHeatMap(!showHeatMap);
                  }}
                >
                  <BarChart className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Análise de Setores</p>
              </TooltipContent>
            </Tooltip>
          </div>
          
          <span className="text-xs opacity-70">
            ~{averageTimeBetweenNumbers}s/número
          </span>
        </CardFooter>
        
        {/* Overlay de mapa de calor quando ativado */}
        {showHeatMap && sectorAnalysis && (
          <div 
            className="absolute inset-0 bg-black/90 z-20 flex items-center justify-center p-4"
            onClick={(e) => {
              e.stopPropagation();
              setShowHeatMap(false);
            }}
          >
            <div className="text-center">
              <h3 className="text-sm font-bold mb-2">Análise de Setores</h3>
              
              {/* Mini-mapa da roleta com últimos números */}
              <div className="relative w-52 h-52 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full border-2 border-slate-600 bg-green-900/50"></div>
                
                {/* Números no formato de roleta real */}
                {ROULETTE_WHEEL_ORDER.map((num, idx) => {
                  const angle = (idx * (360 / 37)) * (Math.PI / 180);
                  const radius = 70;
                  const x = radius * Math.cos(angle) + 78;
                  const y = radius * Math.sin(angle) + 78;
                  
                  // Calculando a intensidade de cor baseada nos dados
                  let intensity = sectorAnalysis.heatMapData[num] || 0;
                  
                  // Verificando se este número está entre os últimos jogados
                  const isInLastNumbers = lastNumbersToDisplay.includes(num);
                  const isLastNumber = lastNumbersToDisplay[0] === num;
                  
                  // Determinar cor baseada no número e intensidade
                  let bgColorClass = "bg-black text-white";
                  if (num === 0) {
                    bgColorClass = "bg-green-600 text-white";
                  } else if ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num)) {
                    // Números vermelhos na roleta
                    if (intensity > 0.7) bgColorClass = "bg-red-700 text-white";
                    else if (intensity > 0.5) bgColorClass = "bg-red-600 text-white";
                    else if (intensity > 0.3) bgColorClass = "bg-red-500 text-white";
                    else bgColorClass = "bg-red-400 text-white";
                  }
                  
                  return (
                    <div 
                      key={`wheel-${num}`}
                      className={cn(
                        "absolute w-5 h-5 rounded-full flex items-center justify-center text-[10px] transform -translate-x-1/2 -translate-y-1/2 border",
                        isLastNumber ? "border-2 border-yellow-300 text-black font-bold" : 
                        isInLastNumbers ? "border border-white" : "border-transparent",
                        bgColorClass
                      )}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        opacity: Math.max(0.7, intensity + 0.2)
                      }}
                    >
                      {num}
                    </div>
                  );
                })}
                
                {/* Legenda indicando últimos números */}
                <div className="absolute -bottom-6 left-0 right-0 flex justify-center">
                  <div className="flex items-center text-xs gap-2">
                    <div className="w-3 h-3 border-2 border-yellow-300 rounded-full"></div>
                    <span>Último número</span>
                    <div className="w-3 h-3 border border-white rounded-full ml-2"></div>
                    <span>Números recentes</span>
                  </div>
                </div>
              </div>
              
              {/* Distribuição em grid */}
              <h4 className="text-xs font-semibold mb-2">Distribuição por Setores</h4>
              <div className="grid grid-cols-6 gap-1 mb-2">
                {Array.from({length: 36}, (_, i) => i + 1).map(num => (
                  <div 
                    key={`heatmap-${num}`}
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs border",
                      lastNumbersToDisplay.includes(num) ? "border-white" : "border-transparent",
                      sectorAnalysis.hotSectors.includes(num) ? "bg-red-500/80 text-white" :
                      sectorAnalysis.coldSectors.includes(num) ? "bg-blue-500/80 text-white" :
                      "bg-slate-700/50"
                    )}
                  >
                    {num}
                  </div>
                ))}
              </div>
              
              <div className="flex justify-center items-center gap-4 text-xs">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-red-500/80 rounded-full mr-1"></div>
                  <span>Quente</span>
                </div>
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-blue-500/80 rounded-full mr-1"></div>
                  <span>Frio</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
      
      {/* Dialog para adicionar comentários */}
      <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Comentários - {nome}</DialogTitle>
            <DialogDescription>
              Compartilhe suas observações sobre esta roleta
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[40vh] overflow-y-auto">
            {comments && comments.length > 0 ? (
              <div className="space-y-3 mb-4">
                {comments.map(comment => (
                  <div key={comment.id} className="bg-muted/30 p-2 rounded-md">
                    <div className="flex justify-between items-center text-xs text-muted-foreground mb-1">
                      <span className="font-semibold">{comment.username}</span>
                      <span>{new Date(comment.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-sm">{comment.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center text-muted-foreground py-6">Nenhum comentário ainda</p>
            )}
          </div>
          
          <div className="flex flex-col gap-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Adicionar um comentário..."
              className="resize-none"
            />
            <Button onClick={handleAddComment} disabled={!comment.trim()}>
              Enviar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RouletteCard;