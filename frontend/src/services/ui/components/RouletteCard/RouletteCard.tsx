import React, { useEffect, useState, useRef } from 'react';
import RESTSocketService from '../../../../services/RESTSocketService';
import './RouletteCard.css';

interface RouletteCardProps {
  roletaId: string;
  roletaNome?: string;
  onSelect?: (id: string, nome: string) => void;
  isSelected?: boolean;
  className?: string;
}

const RouletteCard: React.FC<RouletteCardProps> = ({ 
  roletaId, 
  roletaNome, 
  onSelect, 
  isSelected,
  className
}) => {
  const [numeros, setNumeros] = useState<number[]>([]);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const socketService = useRef<any>(null);
  const subscriberId = useRef<string>(`roulette-ui-card-${roletaId}-${Date.now()}`);
  
  // Função para determinar a cor de um número
  const getCorNumero = (num: number): string => {
    if (num === 0) return 'verde';
    if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(num)) {
      return 'vermelho';
    }
    return 'preto';
  };
  
  // Função para buscar números da roleta
  const fetchRouletteNumbers = async () => {
    try {
      // Obter serviço de socket
      socketService.current = RESTSocketService.getInstance();
      
      // Verificar se o serviço está disponível
      if (!socketService.current) {
        console.error('Serviço de roleta não disponível');
        return;
      }
      
      // Obter histórico da roleta diretamente do serviço
      const history = socketService.current.getRouletteHistory(roletaId);
      
      // Se não houver histórico, solicitar busca específica
      if (!history || history.length === 0) {
        await socketService.current.requestRouletteNumbers(roletaId);
        // Buscar o histórico atualizado
        const updatedHistory = socketService.current.getRouletteHistory(roletaId);
        setNumeros(updatedHistory.slice(0, 12));
      } else {
        // Usar o histórico existente
        setNumeros(history.slice(0, 12));
      }
      
      setUltimaAtualizacao(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error(`Erro ao buscar números para roleta ${roletaId}:`, error);
      setIsLoading(false);
    }
  };
  
  // Processar dados de roleta quando houver atualização
  const processRouletteData = () => {
    if (!roletaId || !socketService.current) return;
    
    // Obter dados atualizados
    const roulettes = socketService.current.getAllRoulettes();
    const rouletteData = roulettes.find((r: any) => r.id === roletaId);
    
    if (rouletteData && rouletteData.numero && Array.isArray(rouletteData.numero)) {
      // Extrair apenas os números
      const numerosArray = rouletteData.numero.map((n: any) => 
        typeof n === 'object' ? (n.numero || n.number || 0) : n
      );
      
      setNumeros(numerosArray.slice(0, 12));
      setUltimaAtualizacao(new Date());
    }
  };
  
  // Efeito para buscar dados e configurar assinatura
  useEffect(() => {
    // Inicializar o serviço
    socketService.current = RESTSocketService.getInstance();
    
    // Buscar dados iniciais
    fetchRouletteNumbers();
    
    // Assinar para atualizações
    if (socketService.current) {
      socketService.current.subscribe(subscriberId.current, processRouletteData);
      
      // Forçar uma atualização inicial
      socketService.current.forceUpdate();
    }
    
    // Configurar timer para atualização periódica
    timerRef.current = setInterval(() => {
      fetchRouletteNumbers();
    }, 15000); // Atualizar a cada 15 segundos
    
    // Limpeza ao desmontar
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (socketService.current) {
        socketService.current.unsubscribe(subscriberId.current);
      }
    };
  }, [roletaId]);
  
  // Função para lidar com seleção da roleta
  const handleClick = () => {
    if (onSelect) {
      onSelect(roletaId, roletaNome || '');
    }
  };
  
  // Renderizar o componente
  return (
    <div 
      className={`roulette-card ${isSelected ? 'roulette-card-selected' : ''} ${className || ''}`}
      onClick={handleClick}
    >
      <div className="roulette-card-header">
        <h3 className="roulette-card-title">{roletaNome || 'Roleta'}</h3>
      </div>
      
      <div className="roulette-card-content">
        {isLoading ? (
          <div className="roulette-card-loading">Carregando...</div>
        ) : (
          <>
            <div className="roulette-card-numbers">
              {numeros.length > 0 ? (
                numeros.map((numero, index) => (
                  <div 
                    key={`${roletaId}-${numero}-${index}`} 
                    className={`roulette-number roulette-number-${getCorNumero(numero)}`}
                  >
                    {numero}
                  </div>
                ))
              ) : (
                <div className="roulette-card-empty">Sem números disponíveis</div>
              )}
            </div>
            
            {ultimaAtualizacao && (
              <div className="roulette-card-footer">
                Última atualização: {ultimaAtualizacao.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RouletteCard; 