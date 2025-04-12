import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import EventService from '@/services/EventService';
import { RouletteNumberEvent } from '@/types';
import RouletteSidePanelStats from '@/components/RouletteSidePanelStats';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

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
  const [socketConnected, setSocketConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  // Adicionar estados para paginação
  const [currentPage, setCurrentPage] = useState(1);
  const numbersPerPage = 100;
  const totalPages = Math.ceil(historyNumbers.length / numbersPerPage);

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
  
  // Configurar WebSocket e buscar dados históricos
  useEffect(() => {
    // Buscar histórico inicial se não fornecido
    const fetchInitialHistory = async () => {
      if (initialNumbers.length === 0) {
        console.log(`[RouletteHistory] Não há números iniciais, buscando para ${roletaId}`);
        try {
          const response = await fetch(`/api/roulette-history?roleta_id=${roletaId}&limit=200`);
          
          if (!response.ok) {
            throw new Error(`Erro ao buscar histórico: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`[RouletteHistory] Dados obtidos com sucesso: ${data.data?.length || 0} números`);
          
          if (data.data && Array.isArray(data.data)) {
            const numbers = data.data.map((item: any) => Number(item.numero)).filter((n: number) => !isNaN(n));
            setHistoryNumbers(numbers);
          }
        } catch (err) {
          console.error(`[RouletteHistory] Erro ao buscar histórico:`, err);
        }
      }
    };
    
    fetchInitialHistory();
    
    // Configurar conexão WebSocket
    const socketURL = import.meta.env.VITE_WEBSOCKET_URL || 'https://runcash-websocket.up.railway.app/';
    console.log(`[RouletteHistory] Conectando ao WebSocket: ${socketURL}`);
    
    const socket = io(socketURL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });
    
    socketRef.current = socket;
    
    socket.on('connect', () => {
      console.log(`[RouletteHistory] WebSocket conectado para ${roletaNome}`);
      setSocketConnected(true);
      
      // Inscrever-se para receber atualizações específicas para esta roleta
      socket.emit('subscribe_roulette', { roletaId });
    });
    
    socket.on('connect_error', (err) => {
      console.error(`[RouletteHistory] Erro de conexão WebSocket para ${roletaNome}:`, err);
      setSocketConnected(false);
    });
    
    socket.on('roulette_number', (event) => {
      // Verificar se o evento é para esta roleta
      if (event.roleta_id === roletaId && typeof event.numero === 'number') {
        console.log(`[RouletteHistory] Novo número recebido via WebSocket para ${roletaNome}: ${event.numero}`);
        
        setHistoryNumbers(prev => {
          // Verificar se o número já existe no início do array
          if (prev.length > 0 && prev[0] === event.numero) {
            return prev;
          }
          
          // Adicionar no início e limitar a 1000 números
          const newHistory = [event.numero, ...prev].slice(0, 1000);
          
          // Emitir evento para outros componentes que possam estar interessados
          EventService.getInstance().dispatchEvent({
            type: 'new_number',
            roleta_id: roletaId,
            roleta_nome: roletaNome,
            numero: event.numero,
            timestamp: new Date().toISOString()
          });
          
          return newHistory;
        });
      }
    });
    
    // Limpar conexões ao desmontar
    return () => {
      console.log(`[RouletteHistory] Desconectando WebSocket para ${roletaNome}`);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [roletaId, roletaNome, initialNumbers]);

  // Função para obter os números da página atual
  const getCurrentPageNumbers = () => {
    const startIndex = (currentPage - 1) * numbersPerPage;
    const endIndex = Math.min(startIndex + numbersPerPage, historyNumbers.length);
    return historyNumbers.slice(startIndex, endIndex);
  };

  // Manipulador para mudar de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Renderiza os controles de paginação
  const renderPagination = () => {
    // Não mostrar paginação se tiver apenas uma página
    if (totalPages <= 1) return null;
    
    // Calcular quais páginas mostrar
    let pagesToShow = [];
    const maxPageButtons = 5;
    
    if (totalPages <= maxPageButtons) {
      // Mostrar todas as páginas se for menor que o máximo
      pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      // Mostrar páginas ao redor da atual
      pagesToShow = [1]; // Sempre mostrar primeira página
      
      const middleStart = Math.max(2, currentPage - 1);
      const middleEnd = Math.min(totalPages - 1, currentPage + 1);
      
      // Adicionar elipse se necessário
      if (middleStart > 2) {
        pagesToShow.push(-1); // -1 representa elipse
      }
      
      // Adicionar páginas ao redor da atual
      for (let i = middleStart; i <= middleEnd; i++) {
        pagesToShow.push(i);
      }
      
      // Adicionar elipse se necessário
      if (middleEnd < totalPages - 1) {
        pagesToShow.push(-2); // -2 representa elipse no final
      }
      
      // Sempre mostrar última página
      pagesToShow.push(totalPages);
    }
    
    return (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {pagesToShow.map((page, index) => {
            // Renderizar elipses
            if (page < 0) {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <span className="mx-1">...</span>
                </PaginationItem>
              );
            }
            
            // Renderizar links para páginas
            return (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => handlePageChange(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };
  
  // Componente retorna um modal customizado com RouletteSidePanelStats
  return (
    <div className={`fixed inset-0 z-50 ${isStatsModalOpen ? 'flex' : 'hidden'} items-center justify-center bg-black/70`}>
      <div className="bg-gray-900 w-11/12 max-w-6xl h-[90vh] rounded-lg overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <div className="flex items-center">
            <h2 className="text-[#00ff00] text-xl font-bold">Estatísticas da {roletaNome}</h2>
            {socketConnected ? (
              <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <span className="w-2 h-2 mr-1 bg-green-400 rounded-full animate-pulse"></span>
                Ao vivo
              </span>
            ) : (
              <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Offline
              </span>
            )}
          </div>
          <button 
            onClick={handleCloseModal}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <RouletteSidePanelStats
            roletaNome={roletaNome}
            lastNumbers={getCurrentPageNumbers()}
            wins={0}
            losses={0}
            historicalNumbers={historyNumbers}
            latestNumber={historyNumbers.length > 0 ? historyNumbers[0] : 0}
            highlightItems={[]}
            isOpen={isStatsModalOpen}
          />
          
          {/* Renderizar componente de paginação */}
          <div className="mt-4 flex justify-center">
            {renderPagination()}
          </div>
          
          {/* Exibir informação sobre quantos números estão sendo exibidos */}
          <div className="mt-2 text-center text-sm text-gray-400">
            Mostrando {Math.min(numbersPerPage, historyNumbers.length)} de {historyNumbers.length} números (Página {currentPage} de {totalPages})
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouletteHistory; 