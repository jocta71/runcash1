import { useEffect, useState } from 'react';
import { Trophy, CircleX, Target } from 'lucide-react';
import { fetchRouletteStrategy } from '@/integrations/api/rouletteService';
import SocketService from '@/services/SocketService';
import EventService from '@/services/EventService';

interface StrategyDataPanelProps {
  roletaId: string;
  roletaNome: string;
}

export const StrategyDataPanel = ({ roletaId, roletaNome }: StrategyDataPanelProps) => {
  const [estado, setEstado] = useState<string>('');
  const [terminais, setTerminais] = useState<number[]>([]);
  const [vitorias, setVitorias] = useState<number>(0);
  const [derrotas, setDerrotas] = useState<number>(0);
  const [sugestao, setSugestao] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Carregar dados iniciais e configurar subscriptions
  useEffect(() => {
    const loadStrategyData = async () => {
      try {
        setLoading(true);
        const data = await fetchRouletteStrategy(roletaId);
        
        if (data) {
          setEstado(data.estado || 'NEUTRAL');
          setTerminais(data.terminais_gatilho || []);
          setVitorias(data.vitorias || 0);
          setDerrotas(data.derrotas || 0);
          setSugestao(data.sugestao_display || '');
        }
      } catch (err: any) {
        console.error(`Erro ao carregar estratégia: ${err.message}`);
        setError(`Falha ao carregar dados`);
      } finally {
        setLoading(false);
      }
    };

    // Carregar dados iniciais
    loadStrategyData();

    // Configurar listeners para atualizações em tempo real
    const eventService = EventService.getInstance();
    const socketService = SocketService.getInstance();

    const handleStrategyUpdate = (event: any) => {
      if (!event) return;
      
      // Verificar se é um evento relevante para esta roleta
      if (event.type === 'strategy_update' && 
          (event.roleta_id === roletaId || event.roleta_nome === roletaNome)) {
        console.log(`[StrategyDataPanel] Atualizando estratégia para ${roletaNome}:`, event);
        
        // Atualizar os estados
        setEstado(event.estado || 'NEUTRAL');
        setTerminais(event.terminais_gatilho || []);
        setVitorias(event.vitorias || 0);
        setDerrotas(event.derrotas || 0);
        setSugestao(event.sugestao_display || '');
      }
    };

    // Subscrever para eventos
    eventService.subscribe(roletaNome, handleStrategyUpdate as any);
    eventService.subscribe('*', handleStrategyUpdate as any);
    socketService.subscribe(roletaNome, handleStrategyUpdate);
    socketService.subscribe('global_strategy_updates', handleStrategyUpdate);
    
    // Cleanup
    return () => {
      eventService.unsubscribe(roletaNome, handleStrategyUpdate as any);
      eventService.unsubscribe('*', handleStrategyUpdate as any);
      socketService.unsubscribe(roletaNome, handleStrategyUpdate);
      socketService.unsubscribe('global_strategy_updates', handleStrategyUpdate);
    };
  }, [roletaId, roletaNome]);

  if (loading) {
    return (
      <div className="w-full bg-black/80 border-2 border-green-400 rounded-md p-3 shadow-lg z-50 animate-pulse">
        <p className="text-white text-xs">Carregando dados...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full bg-black/80 border-2 border-red-400 rounded-md p-3 shadow-lg z-50">
        <p className="text-red-400 text-xs">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-black/80 border-2 border-green-400 rounded-md p-3 shadow-lg z-50">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-green-400 text-xs font-bold">DADOS MONGODB - {roletaNome}</h3>
      </div>

      {/* Estado da estratégia */}
      <div className="mb-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-300 text-xs">Estado:</span>
          <span className={`text-xs font-bold ${
            estado === 'TRIGGER' ? 'text-green-500' : 
            estado === 'POST_GALE_NEUTRAL' ? 'text-yellow-500' : 
            estado === 'MORTO' ? 'text-red-500' : 
            'text-blue-500'
          }`}>
            {estado}
          </span>
        </div>
      </div>

      {/* Terminais */}
      <div className="mb-2">
        <div className="text-gray-300 text-xs mb-1 flex items-center gap-1">
          <Target size={10} />
          <span>Terminais:</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {terminais && terminais.length > 0 ? (
            terminais.map((terminal, idx) => (
              <div key={idx} className="w-6 h-6 rounded-full bg-green-500/20 border border-green-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{terminal}</span>
              </div>
            ))
          ) : (
            <span className="text-gray-400 text-[10px]">Sem terminais</span>
          )}
        </div>
      </div>

      {/* Vitórias e Derrotas */}
      <div className="flex justify-between mb-2 bg-black/30 p-1.5 rounded-md">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Trophy size={12} className="text-green-500" />
            <span className="text-green-400 text-xs font-bold">{vitorias}</span>
          </div>
          <div className="flex items-center gap-1">
            <CircleX size={12} className="text-red-500" />
            <span className="text-red-400 text-xs font-bold">{derrotas}</span>
          </div>
        </div>
        <div className="text-[10px] text-gray-400">
          Taxa: {vitorias + derrotas > 0 ? Math.round((vitorias / (vitorias + derrotas)) * 100) : 0}%
        </div>
      </div>

      {/* Sugestão */}
      {sugestao && (
        <div className="px-2 py-1 bg-black/30 rounded border border-gray-700">
          <p className="text-[11px] text-green-400">{sugestao}</p>
        </div>
      )}
    </div>
  );
};

export default StrategyDataPanel; 