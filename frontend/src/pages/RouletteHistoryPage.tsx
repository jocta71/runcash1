import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import RouletteHistory from '@/components/roulette/RouletteHistory';
import SocketService from '@/services/SocketService';
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
    if (existingHistory.length > 0) {
      setHistoryData(existingHistory);
      setLoading(false);
    } else {
      // Se não temos, buscar via API
      socketService.fetchRouletteNumbersREST(canonicalId)
        .then(success => {
          if (success) {
            const updatedHistory = socketService.getRouletteHistory(canonicalId);
            setHistoryData(updatedHistory);
          } else {
            console.warn(`[HistoryPage] Falha ao buscar histórico para ${canonicalId}`);
          }
          setLoading(false);
        })
        .catch(error => {
          console.error(`[HistoryPage] Erro ao buscar histórico:`, error);
          setLoading(false);
        });
    }
    
    // Iniciar polling para manter os dados atualizados
    socketService.startAggressivePolling(canonicalId, roletaNome);
    
    return () => {
      // Não parar o polling ao sair, pois pode ser útil para outras partes da aplicação
    };
  }, [roletaId, navigate]);
  
  // Manipular retorno à página anterior
  const handleBack = () => {
    navigate(-1);
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center">
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
      
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-[400px] w-full" />
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