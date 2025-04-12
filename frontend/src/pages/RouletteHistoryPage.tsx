import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RouletteHistory from '@/components/roulette/RouletteHistory';
import SocketService from '@/services/SocketService';
import RouletteFeedService from '@/services/RouletteFeedService';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

const RouletteHistoryPage: React.FC = () => {
  const { roletaId } = useParams<{ roletaId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roletaNome, setRouletaNome] = useState<string>('');
  const [historyData, setHistoryData] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'stats'>('grid');
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Adicionar estados para controle de paginação a nível da página
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(200);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 200;
  
  useEffect(() => {
    if (!roletaId) {
      navigate('/');
      return;
    }
    
    // Normalizar o ID da roleta
    const canonicalId = mapToCanonicalRouletteId(roletaId);
    
    // Buscar o nome da roleta
    const roleta = ROLETAS_CANONICAS.find(r => r.id === canonicalId);
    if (roleta) {
      setRouletaNome(roleta.nome);
    } else {
      setRouletaNome(`Roleta ${canonicalId}`);
    }
    
    // Buscar dados históricos
    const socketService = SocketService.getInstance();
    
    // Primeiro verificar se já temos histórico em memória
    const existingHistory = socketService.getRouletteHistory(canonicalId);
    console.log(`[HistoryPage] Verificando histórico existente para ${canonicalId}: ${existingHistory.length} números`);
    
    if (existingHistory.length > 0) {
      setHistoryData(existingHistory);
      setTotalItems(existingHistory.length);
      setLoading(false);
      setLoadError(null);
    } else {
      // Se não temos, buscar via API
      console.log(`[HistoryPage] Buscando dados via API para ${canonicalId}`);
      fetchHistoryData(canonicalId, currentPage, limit);
    }
    
    // Inicializar o serviço de feed de roletas
    const rouletteFeedService = RouletteFeedService.getInstance();
    rouletteFeedService.start();
    
    return () => {
      // Não é necessário parar o serviço aqui, pois ele é gerenciado globalmente
    };
  }, [roletaId, navigate, currentPage, limit]);
  
  // Função para buscar dados do histórico com paginação
  const fetchHistoryData = async (canonicalId: string, page: number = 1, itemsPerPage: number = 200) => {
    setLoading(true);
    setLoadError(null);
    
    try {
      const socketService = SocketService.getInstance();
      console.log(`[HistoryPage] Iniciando busca de dados para ${canonicalId} (página ${page}, limit ${itemsPerPage})`);
      
      // Calcular offset baseado na página e limite por página
      const offset = (page - 1) * itemsPerPage;
      
      // Solicitar números com paginação
      const success = await socketService.fetchRouletteNumbersREST(
        canonicalId, 
        itemsPerPage, 
        offset,
        (total) => {
          // Callback para receber o total de itens disponíveis
          setTotalItems(total);
        }
      );
      
      if (success) {
        const updatedHistory = socketService.getRouletteHistory(canonicalId);
        console.log(`[HistoryPage] Dados obtidos com sucesso: ${updatedHistory.length} números`);
        setHistoryData(updatedHistory);
        setLoadError(null);
      } else {
        console.warn(`[HistoryPage] Falha ao buscar histórico para ${canonicalId}`);
        setLoadError("Não foi possível carregar o histórico. Tente novamente.");
      }
    } catch (error) {
      console.error(`[HistoryPage] Erro ao buscar histórico:`, error);
      setLoadError("Erro ao carregar o histórico: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };
  
  // Manipular atualização manual
  const handleRefresh = () => {
    if (roletaId) {
      const canonicalId = mapToCanonicalRouletteId(roletaId);
      fetchHistoryData(canonicalId, currentPage, limit);
    }
  };
  
  // Manipular mudança de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Ao mudar de página, também atualizamos os dados
    if (roletaId) {
      const canonicalId = mapToCanonicalRouletteId(roletaId);
      fetchHistoryData(canonicalId, page, limit);
    }
  };
  
  // Manipular retorno à página anterior
  const handleBack = () => {
    navigate(-1);
  };
  
  // Renderizar controles de paginação
  const renderPagination = () => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
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
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleBack} 
            className="mr-2"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Histórico Completo</h1>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? 'Carregando...' : 'Atualizar Dados'}
        </Button>
      </div>
      
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[400px] w-full" />
        </div>
      ) : loadError ? (
        <div className="rounded-md bg-red-50 p-4 text-red-700">
          <p>{loadError}</p>
          <Button className="mt-2" variant="outline" onClick={handleRefresh}>
            Tentar Novamente
          </Button>
        </div>
      ) : (
        <>
          <RouletteHistory 
            roletaId={roletaId || ''} 
            roletaNome={roletaNome} 
            initialNumbers={historyData} 
          />
          
          {/* Informações de paginação */}
          <div className="mt-4 flex flex-col items-center space-y-2">
            <div className="text-sm text-gray-500">
              Mostrando {Math.min(itemsPerPage, historyData.length)} de {totalItems} números
            </div>
            
            {renderPagination()}
          </div>
        </>
      )}
    </div>
  );
};

export default RouletteHistoryPage; 