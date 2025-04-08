import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RouletteHistory from '@/components/roulette/RouletteHistory';
import SocketService from '@/services/SocketService';
import RouletteFeedService from '@/services/RouletteFeedService';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { mapToCanonicalRouletteId, ROLETAS_CANONICAS } from '../integrations/api/rouletteService';

const RouletteHistoryPage: React.FC = () => {
  const { roletaId } = useParams<{ roletaId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [roletaNome, setRouletaNome] = useState<string>('');
  const [historyData, setHistoryData] = useState<number[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'stats'>('grid');
  const [loadError, setLoadError] = useState<string | null>(null);
  
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
      setLoading(false);
      setLoadError(null);
    } else {
      // Se não temos, buscar via API
      console.log(`[HistoryPage] Buscando dados via API para ${canonicalId}`);
      fetchHistoryData(canonicalId);
    }
    
    // Inicializar o serviço de feed de roletas
    const rouletteFeedService = RouletteFeedService.getInstance();
    rouletteFeedService.start();
    
    return () => {
      // Não é necessário parar o serviço aqui, pois ele é gerenciado globalmente
    };
  }, [roletaId, navigate]);
  
  // Função para buscar dados do histórico
  const fetchHistoryData = async (canonicalId: string) => {
    setLoading(true);
    setLoadError(null);
    
    try {
      const socketService = SocketService.getInstance();
      console.log(`[HistoryPage] Iniciando busca de dados para ${canonicalId}`);
      
      // Solicitar 200 números para a página de histórico
      const success = await socketService.fetchRouletteNumbersREST(canonicalId, 200);
      
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
      fetchHistoryData(canonicalId);
    }
  };
  
  // Manipular retorno à página anterior
  const handleBack = () => {
    navigate(-1);
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
        <RouletteHistory 
          roletaId={roletaId || ''} 
          roletaNome={roletaNome} 
          initialNumbers={historyData} 
        />
      )}
    </div>
  );
};

export default RouletteHistoryPage; 