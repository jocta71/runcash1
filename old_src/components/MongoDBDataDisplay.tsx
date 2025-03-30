import React from 'react';
import { Trophy, CircleX, Target } from 'lucide-react';

interface MongoDBDataDisplayProps {
  estado: string;
  terminais: number[];
  vitorias: number;
  derrotas: number;
  sugestao: string;
  roletaId: string;
}

/**
 * Componente dedicado para exibir dados do MongoDB
 * Este é renderizado independentemente do RouletteCard
 */
const MongoDBDataDisplay = ({ 
  estado, 
  terminais, 
  vitorias, 
  derrotas, 
  sugestao,
  roletaId
}: MongoDBDataDisplayProps) => {
  return (
    <div className="fixed bottom-4 right-4 p-3 bg-black/90 rounded-lg border-2 border-green-500 shadow-lg z-50 max-w-[300px]">
      <div className="flex justify-between items-center mb-2">
        <div className="text-green-400 text-sm font-bold uppercase">Dados MongoDB</div>
        <div className="text-[10px] text-gray-400">ID: {roletaId.substring(0, 8)}...</div>
      </div>
      
      {/* Estado da Estratégia */}
      <div className="flex justify-between items-center mb-1">
        <span className="text-gray-300 text-xs">Estado:</span>
        <span className={`text-xs font-bold ${
          estado === 'TRIGGER' ? 'text-green-500' : 
          estado === 'POST_GALE_NEUTRAL' ? 'text-yellow-500' : 
          estado === 'MORTO' ? 'text-red-500' : 
          'text-blue-500'
        }`}>
          {estado || "NEUTRAL"}
        </span>
      </div>

      {/* Terminais Gatilho */}
      <div className="mb-2">
        <div className="text-gray-300 text-xs mb-1">Terminais:</div>
        <div className="flex flex-wrap gap-1">
          {(terminais && terminais.length > 0) 
            ? terminais.map((term, idx) => (
              <div key={idx} className="w-6 h-6 rounded-full bg-green-500/30 border border-green-500 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">{term}</span>
              </div>
            ))
            : <span className="text-[10px] text-gray-400">Sem terminais</span>
          }
        </div>
      </div>
      
      {/* Vitórias e Derrotas */}
      <div className="flex mb-2 justify-between">
        <div className="flex items-center gap-1">
          <Trophy size={14} className="text-green-500" />
          <span className="text-green-400 text-xs font-bold">{vitorias}</span>
        </div>
        <div className="flex items-center gap-1">
          <CircleX size={14} className="text-red-500" />
          <span className="text-red-400 text-xs font-bold">{derrotas}</span>
        </div>
        <div className="text-[9px] text-gray-400">
          Taxa: {vitorias + derrotas > 0 ? Math.round((vitorias / (vitorias + derrotas)) * 100) : 0}%
        </div>
      </div>

      {/* Sugestão Display */}
      {sugestao && (
        <div className="px-2 py-1 rounded bg-black/70 border border-gray-700">
          <p className="text-xs text-green-400">{sugestao}</p>
        </div>
      )}
    </div>
  );
};

export default MongoDBDataDisplay; 