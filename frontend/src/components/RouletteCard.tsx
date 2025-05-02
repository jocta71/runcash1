import React, { useEffect, useState, useRef, useCallback } from 'react';
import RouletteNumber from './RouletteNumber';
import { Box, Grid, Typography, Card, CardContent, Skeleton, Tooltip as MuiTooltip, Button } from '@mui/material';
import { formatDateTime } from '../utils/formatters';
import RESTSocketService from '../services/RESTSocketService';
import { styled } from '@mui/material/styles';
import clsx from 'clsx';

// Constantes para formatos
const MAX_NUMBERS_DISPLAYED = 12;
const DEFAULT_NUMBERS_HISTORY = 15;
const POLLING_INTERVAL = 5000; // 5 segundos
const NUM_SKELETONS = 6;

// Interface para tipar as props do componente
interface RouletteCardProps {
  roletaId?: string;
  roletaNome?: string;
  className?: string;
  onSelect?: (id: string, nome: string) => void;
  isSelected?: boolean;
  viewMode?: 'compact' | 'full' | 'mini';
  showHeader?: boolean;
  showTimestamp?: boolean;
  variant?: 'default' | 'dark' | 'light';
  showControls?: boolean;
  numNumbersToShow?: number;
  refreshInterval?: number;
  showRefreshButton?: boolean;
  isHighContrast?: boolean;
  isDraggable?: boolean;
}

const StyledCard = styled(Card)(({ theme }) => ({
  background: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  boxShadow: theme.shadows[3],
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'visible',
  '&:hover': {
    boxShadow: theme.shadows[6],
    transform: 'translateY(-2px)',
  },
  '&.selected': {
    borderColor: theme.palette.primary.main,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  '&.draggable': {
    cursor: 'move',
  }
}));

const RouletteCard: React.FC<RouletteCardProps> = ({ 
  roletaId, 
  roletaNome, 
  className, 
  onSelect, 
  isSelected = false,
  viewMode = 'full',
  showHeader = true,
  showTimestamp = true,
  variant = 'default',
  showControls = true,
  numNumbersToShow = MAX_NUMBERS_DISPLAYED,
  refreshInterval = POLLING_INTERVAL,
  showRefreshButton = true,
  isHighContrast = false,
  isDraggable = false
}) => {
  // Estado para armazenar os dados da roleta
  const [numeros, setNumeros] = useState<number[]>([]);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const socketService = useRef<any>(null);
  const subscriberId = useRef<string>(`roulette-card-${roletaId}-${Date.now()}`);
  
  // Função para buscar os números da roleta
  const fetchRouletteNumbers = useCallback(async () => {
    if (!roletaId) return;
    
    try {
      setIsRefreshing(true);
      
      // Buscar dados através do serviço REST
      socketService.current = RESTSocketService.getInstance();
      
      // Verificar se o serviço está disponível
      if (!socketService.current) {
        throw new Error('Serviço de dados indisponível');
      }
      
      // Obter o histórico de números desta roleta
      const rouletteHistory = socketService.current.getRouletteHistory(roletaId);
      
      // Se não tiver histórico, tentar uma busca específica
      if (!rouletteHistory || rouletteHistory.length === 0) {
        await socketService.current.requestRouletteNumbers(roletaId);
        // Buscar novamente após a requisição
        const updatedHistory = socketService.current.getRouletteHistory(roletaId);
        setNumeros(updatedHistory.slice(0, numNumbersToShow));
      } else {
        // Usar o histórico existente
        setNumeros(rouletteHistory.slice(0, numNumbersToShow));
      }
      
      setLastUpdateTime(new Date());
      setError(null);
    } catch (err) {
      console.error(`Erro ao buscar números da roleta ${roletaId}:`, err);
      setError('Erro ao carregar dados');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [roletaId, numNumbersToShow]);
  
  // Função para processar novos dados de roletas
  const processRouletteData = useCallback(() => {
    if (!roletaId || !socketService.current) return;
    
    // Obter dados atualizados
    const currentData = socketService.current.getAllRoulettes();
    const rouletteData = currentData.find((r: any) => r.id === roletaId);
    
    if (rouletteData && rouletteData.numero && Array.isArray(rouletteData.numero)) {
      // Extrair apenas os números
      const numerosArray = rouletteData.numero.map((n: any) => 
        typeof n === 'object' ? (n.numero || n.number || 0) : n
      );
      
      setNumeros(numerosArray.slice(0, numNumbersToShow));
      setLastUpdateTime(new Date());
    }
  }, [roletaId, numNumbersToShow]);
  
  // Configurar o polling inicial e subscrição a eventos
  useEffect(() => {
    // Inicializar o serviço
    socketService.current = RESTSocketService.getInstance();
    
    // Buscar dados iniciais
    fetchRouletteNumbers();
    
    // Subscrever para receber atualizações
    if (socketService.current) {
      socketService.current.subscribe(subscriberId.current, processRouletteData);
      
      // Forçar uma atualização inicial
      socketService.current.forceUpdate();
    }
    
    // Configurar intervalo para atualização periódica
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchRouletteNumbers();
      }, refreshInterval);
    }
    
    // Limpeza ao desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      if (socketService.current) {
        socketService.current.unsubscribe(subscriberId.current);
      }
    };
  }, [fetchRouletteNumbers, processRouletteData, refreshInterval]);
  
  // Função para lidar com o clique no card
  const handleCardClick = () => {
    if (onSelect && roletaId) {
      onSelect(roletaId, roletaNome || '');
    }
  };
  
  // Função para forçar atualização manual
  const handleRefresh = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchRouletteNumbers();
  };
  
  // Renderizar esqueleto durante carregamento
  if (isLoading) {
    return (
      <StyledCard 
        className={clsx(className, { selected: isSelected, draggable: isDraggable })}
        onClick={handleCardClick}
      >
        <CardContent>
          <Typography variant="h6">
            <Skeleton width="80%" />
          </Typography>
          <Box mt={1} display="flex" flexWrap="wrap" gap={1}>
            {Array.from({ length: NUM_SKELETONS }).map((_, index) => (
              <Skeleton key={index} variant="circular" width={40} height={40} />
            ))}
          </Box>
        </CardContent>
      </StyledCard>
    );
  }
  
  // Renderizar mensagem de erro
  if (error) {
    return (
      <StyledCard 
        className={clsx(className, { selected: isSelected, draggable: isDraggable })}
        onClick={handleCardClick}
      >
        <CardContent>
          <Typography variant="h6" color="error">
            {roletaNome || 'Roleta'}
          </Typography>
          <Typography color="error">{error}</Typography>
          {showRefreshButton && (
            <Button 
              variant="text" 
              color="primary" 
              onClick={handleRefresh} 
              disabled={isRefreshing}
              size="small"
            >
              Tentar novamente
            </Button>
          )}
        </CardContent>
      </StyledCard>
    );
  }
  
  // Renderizar o componente principal
  return (
    <>
      <MuiTooltip 
        title={
          <div>
            <span>{roletaNome}</span>
            {numeros.length > 0 && (
              <div>
                <strong>Últimos números:</strong> {numeros.slice(0, 10).join(', ')}
              </div>
            )}
          </div>
        }
        arrow
        placement="top"
      >
        <StyledCard 
          className={clsx(className, { selected: isSelected, draggable: isDraggable })}
          onClick={handleCardClick}
          variant={variant === 'default' ? 'outlined' : 'elevation'}
        >
          <CardContent>
            {showHeader && (
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="h6" component="h2" noWrap>
                  {roletaNome || 'Roleta'}
                </Typography>
                {showControls && showRefreshButton && (
                  <Button 
                    variant="text" 
                    color="primary" 
                    onClick={handleRefresh} 
                    disabled={isRefreshing}
                    size="small"
                  >
                    {isRefreshing ? 'Atualizando...' : 'Atualizar'}
                  </Button>
                )}
              </Box>
            )}
            
            <Box display="flex" flexWrap="wrap" gap={1}>
              {numeros.length > 0 ? (
                numeros.slice(0, numNumbersToShow).map((numero, index) => (
                  <RouletteNumber 
                    key={`${roletaId}-${numero}-${index}`} 
                    number={numero} 
                    isHighContrast={isHighContrast}
                    size={viewMode === 'compact' ? 'small' : viewMode === 'mini' ? 'mini' : 'medium'}
                  />
                ))
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Sem números disponíveis
                </Typography>
              )}
            </Box>
            
            {showTimestamp && lastUpdateTime && (
              <Typography variant="caption" display="block" color="textSecondary" mt={1}>
                Última atualização: {formatDateTime(lastUpdateTime)}
              </Typography>
            )}
          </CardContent>
        </StyledCard>
      </MuiTooltip>
    </>
  );
};

export default RouletteCard;