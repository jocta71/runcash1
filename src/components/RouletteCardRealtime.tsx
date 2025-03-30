import { useState, useEffect, useMemo } from 'react';
import { useRouletteData, RouletteNumber, RouletteStrategy } from '@/hooks/useRouletteData';

// Interface for the component props
interface RouletteCardRealtimeProps {
  roletaId: string;
  roletaNome: string;
  onNumberChange?: (number: number) => void;
}

// Main component for displaying roulette information in real-time
export default function RouletteCardRealtime({ 
  roletaId, 
  roletaNome,
  onNumberChange
}: RouletteCardRealtimeProps) {
  // Use our custom hook to get real-time data
  const { 
    numbers, 
    loading, 
    error, 
    isConnected, 
    hasData,
    strategy,
    strategyLoading,
    refreshNumbers 
  } = useRouletteData(roletaId, roletaNome);

  // Last 10 numbers to display in the history
  const lastNumbers = useMemo(() => {
    return numbers.slice(0, 10).map(n => n.numero);
  }, [numbers]);

  // State for animation when new numbers come in
  const [animatingIndex, setAnimatingIndex] = useState<number | null>(null);
  
  // Trigger animation when a new number is added
  useEffect(() => {
    if (numbers.length > 0) {
      setAnimatingIndex(0);
      
      // Call onNumberChange callback if provided
      if (onNumberChange && numbers[0]?.numero !== undefined) {
        onNumberChange(numbers[0].numero);
      }
      
      // Clear animation after 1.5 seconds
      const timer = setTimeout(() => {
        setAnimatingIndex(null);
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [numbers, onNumberChange]);

  // Format number display
  const formatNumber = (num: number) => {
    return num.toString().padStart(2, '0');
  };

  // Get color class based on number
  const getColorClass = (numero: number) => {
    if (numero === 0) return 'bg-green-500 text-white';
    return numero % 2 === 0 
      ? 'bg-black text-white' 
      : 'bg-red-600 text-white';
  };

  // Show loading state
  if (loading && !hasData) {
    return (
      <div className="border rounded-lg p-4 w-full max-w-md animate-pulse bg-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 bg-gray-300 rounded w-1/3"></div>
          <div className="h-4 bg-gray-300 rounded w-1/4"></div>
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-gray-300 rounded"></div>
          <div className="flex space-x-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-10 w-10 bg-gray-300 rounded-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !hasData) {
    return (
      <div className="border border-red-300 rounded-lg p-4 w-full max-w-md bg-red-50">
        <h3 className="font-bold text-lg text-red-700 mb-2">{roletaNome}</h3>
        <p className="text-red-600 text-sm mb-4">Erro ao carregar dados</p>
        <button 
          onClick={() => refreshNumbers()} 
          className="bg-red-600 text-white py-1 px-3 rounded text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-4 w-full max-w-md ${!isConnected ? 'bg-gray-100' : 'bg-white'}`}>
      {/* Header with roulette name and connection status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">{roletaNome}</h3>
        <div className="flex items-center space-x-2">
          {!isConnected && (
            <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
              Offline
            </span>
          )}
          <button 
            onClick={() => refreshNumbers()} 
            className="text-blue-600 hover:text-blue-800"
            title="Atualizar"
          >
            ↻
          </button>
        </div>
      </div>
      
      {/* Main number display */}
      {numbers.length > 0 && (
        <div className="mb-4">
          <div 
            className={`
              ${getColorClass(numbers[0].numero)} 
              rounded-lg p-4 text-center text-3xl font-bold
              ${animatingIndex === 0 ? 'scale-in-center' : ''}
            `}
          >
            {formatNumber(numbers[0].numero)}
          </div>
        </div>
      )}
      
      {/* Numbers history */}
      <div className="flex flex-wrap gap-2 mb-4">
        {lastNumbers.slice(1).map((numero, index) => (
          <div 
            key={index} 
            className={`
              ${getColorClass(numero)} 
              w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
              ${animatingIndex === index + 1 ? 'pulse-animation' : ''}
            `}
          >
            {formatNumber(numero)}
          </div>
        ))}
      </div>
      
      {/* Strategy display */}
      {strategy && !strategyLoading && (
        <div className="mt-4 border-t pt-2">
          <div className="flex justify-between text-sm">
            <div>
              <span className="font-semibold">Vitórias:</span> {strategy.vitorias}
            </div>
            <div>
              <span className="font-semibold">Derrotas:</span> {strategy.derrotas}
            </div>
          </div>
          
          {strategy.terminais_gatilho && strategy.terminais_gatilho.length > 0 && (
            <div className="mt-2 text-sm">
              <span className="font-semibold">Terminais:</span> {strategy.terminais_gatilho.join(', ')}
            </div>
          )}
          
          {strategy.estado_display && (
            <div className={`mt-2 text-sm font-medium ${
              strategy.estado === 'AGUARDANDO' ? 'text-yellow-600' :
              strategy.estado === 'ENTRADA' ? 'text-green-600' :
              strategy.estado === 'GANHOU' ? 'text-emerald-600' :
              strategy.estado === 'PERDEU' ? 'text-red-600' :
              'text-gray-600'
            }`}>
              {strategy.estado_display}
            </div>
          )}
        </div>
      )}
      
      {/* Timestamp */}
      {numbers.length > 0 && (
        <div className="text-gray-400 text-xs mt-4 text-right">
          Última atualização: {new Date(numbers[0].timestamp).toLocaleTimeString()}
        </div>
      )}
      
      {/* CSS for animations */}
      <style jsx>{`
        @keyframes scale-in-center {
          0% { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .scale-in-center {
          animation: scale-in-center 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
        }
        
        @keyframes pulse-animation {
          0% { transform: scale(1); }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .pulse-animation {
          animation: pulse-animation 0.75s ease-in-out;
        }
      `}</style>
    </div>
  );
} 