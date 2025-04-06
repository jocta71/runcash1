import React, { useState, useEffect } from 'react';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';
import { RouletteNumberEvent } from '@/types';
import RouletteStatsModal from '@/components/RouletteStatsModal';

interface RouletteHistoryProps {
  roletaId: string;
  roletaNome: string;
  initialNumbers?: number[];
  isOpen?: boolean;
  onClose?: () => void;
}

const RouletteHistory: React.FC<RouletteHistoryProps> = ({ 
  roletaId, 
  roletaNome, 
  initialNumbers = [],
  isOpen = false,
  onClose
}) => {
  const [historyNumbers, setHistoryNumbers] = useState<number[]>(initialNumbers);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(isOpen);

  // Sincronizar o estado do modal com o prop isOpen
  useEffect(() => {
    setIsStatsModalOpen(isOpen);
  }, [isOpen]);
  
  // Quando o modal é fechado, notificar o componente pai se onClose estiver definido
  const handleCloseModal = () => {
    setIsStatsModalOpen(false);
    if (onClose) {
      onClose();
    }
  };
  
  // Log inicial para diagnóstico
  console.log(`[RouletteHistory] Inicializando com ${initialNumbers.length} números para ${roletaNome}`);
  
  // Inscrever-se para receber atualizações de números
  useEffect(() => {
    // Handler para novos números
    const handleNewNumber = (event: RouletteNumberEvent) => {
      if (event.roleta_id === roletaId && typeof event.numero === 'number') {
        console.log(`[RouletteHistory] Novo número recebido para ${roletaNome}: ${event.numero}`);
        setHistoryNumbers(prev => {
          // Verificar se o número já existe no início do array
          if (prev.length > 0 && prev[0] === event.numero) {
            return prev;
          }
          
          // Adicionar no início e limitar a 1000 números
          const newHistory = [event.numero, ...prev].slice(0, 1000);
          return newHistory;
        });
      }
    };
    
    // Inscrever-se para eventos de novos números
    EventService.getInstance().subscribe('new_number', handleNewNumber);
    
    // Buscar histórico inicial se não fornecido
    if (initialNumbers.length === 0) {
      console.log(`[RouletteHistory] Não há números iniciais, buscando para ${roletaId}`);
      SocketService.getInstance().fetchRouletteNumbersREST(roletaId, 200)
        .then(success => {
          if (success) {
            const history = SocketService.getInstance().getRouletteHistory(roletaId);
            console.log(`[RouletteHistory] Dados obtidos com sucesso: ${history.length} números`);
            setHistoryNumbers(history);
          } else {
            console.warn(`[RouletteHistory] Falha ao buscar histórico para ${roletaNome}`);
          }
        })
        .catch(err => {
          console.error(`[RouletteHistory] Erro ao buscar histórico:`, err);
        });
    }
    
    return () => {
      // Limpar inscrição ao desmontar
      EventService.getInstance().unsubscribe('new_number', handleNewNumber);
    };
  }, [roletaId, roletaNome, initialNumbers]);
  
  // Componente agora retorna apenas o modal, sem nenhuma outra interface
  return (
    <RouletteStatsModal
      open={isStatsModalOpen}
      onClose={handleCloseModal}
      roletaNome={roletaNome}
      lastNumbers={historyNumbers}
      wins={0}
      losses={0}
    />
  );
};

export default RouletteHistory; 