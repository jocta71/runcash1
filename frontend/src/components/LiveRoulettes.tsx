import React, { useState } from 'react';
import { useRouletteStream } from '../hooks/useRouletteStream';
import './LiveRoulettes.css'; // Assumimos que o estilo CSS será movido para este arquivo

interface LiveRoulettesProps {
  rouletteId?: string; // Se fornecido, mostra apenas uma roleta específica
}

/**
 * Componente que exibe dados de roletas em tempo real usando Server-Sent Events
 */
const LiveRoulettes: React.FC<LiveRoulettesProps> = ({ rouletteId }) => {
  // Estado para controlar a conexão
  const [isManuallyDisconnected, setIsManuallyDisconnected] = useState(false);
  
  // Usar o hook de streaming de roletas
  const {
    data,
    isConnected,
    isLoading,
    error,
    reconnect,
    disconnect
  } = useRouletteStream(rouletteId, {
    onConnect: () => console.log('Conexão com stream estabelecida'),
    onDisconnect: () => console.log('Conexão com stream encerrada'),
    onError: (err) => console.error('Erro no stream:', err)
  });
  
  // Função para alternar a conexão
  const toggleConnection = () => {
    if (isConnected) {
      disconnect();
      setIsManuallyDisconnected(true);
    } else {
      reconnect();
      setIsManuallyDisconnected(false);
    }
  };
  
  // Renderização do componente
  return (
    <div className="live-roulettes">
      <div className="header">
        <h2>Roletas em Tempo Real</h2>
        <div className="connection-status">
          {isConnected ? (
            <span className="status connected">Conectado</span>
          ) : (
            <span className="status disconnected">Desconectado</span>
          )}
          <button 
            onClick={toggleConnection}
            className={isConnected ? 'disconnect-btn' : 'connect-btn'}
          >
            {isConnected ? 'Desconectar' : 'Conectar'}
          </button>
        </div>
      </div>
      
      {isLoading && !isManuallyDisconnected && (
        <div className="loading">Carregando dados...</div>
      )}
      
      {error && !isManuallyDisconnected && (
        <div className="error">
          <p>Erro ao obter dados: {error.message}</p>
          <button onClick={reconnect}>Tentar novamente</button>
        </div>
      )}
      
      {data && !isLoading && isConnected && (
        <div className="data-container">
          {/* Mostrar dados recebidos */}
          {data.type === 'initial' && data.roulette && (
            <div className="single-roulette">
              <h3>{data.roulette.nome || data.roulette.name || 'Roleta'}</h3>
              <p>Última atualização: {new Date(data.timestamp || 0).toLocaleString()}</p>
              
              {/* Informações específicas da roleta */}
              <div className="roulette-info">
                <p>ID: {data.roulette.id}</p>
                <p>Fornecedor: {data.roulette.provider || 'N/A'}</p>
              </div>
              
              {/* Números recentes */}
              {data.numbers && data.numbers.length > 0 && (
                <div className="recent-numbers">
                  <h4>Números Recentes</h4>
                  <div className="number-list">
                    {data.numbers.map((num: any, index: number) => (
                      <span 
                        key={index} 
                        className={`number ${num.cor || 'black'}`}
                        title={`${num.numero} - ${new Date(num.timestamp || 0).toLocaleString()}`}
                      >
                        {num.numero}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Lista de roletas (quando não for uma roleta específica) */}
          {data.type === 'initial' && data.roulettes && (
            <div className="roulette-list">
              <p>Total de roletas: {data.totalCount || 0}</p>
              <p>Disponíveis para seu plano: {data.availableCount || 0}</p>
              
              <div className="roulettes-grid">
                {data.roulettes.map((roulette: any) => (
                  <div key={roulette.id} className="roulette-card">
                    <h3>{roulette.nome || roulette.name || 'Roleta'}</h3>
                    <p>ID: {roulette.id}</p>
                    <p>Fornecedor: {roulette.provider || 'N/A'}</p>
                    <button 
                      onClick={() => window.location.href = `/roulette/${roulette.id}`}
                      className="view-details-btn"
                    >
                      Ver detalhes
                    </button>
                  </div>
                ))}
              </div>
              
              {data.limited && (
                <div className="upgrade-notice">
                  <p>Você tem acesso a {data.availableCount} de {data.totalCount} roletas. Atualize seu plano para ver mais!</p>
                  <button 
                    onClick={() => window.location.href = '/planos'}
                    className="upgrade-btn"
                  >
                    Ver planos
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Dados de atualização */}
          {data.type === 'update' && (
            <div className="update-notification">
              <p>Dados atualizados em {new Date(data.timestamp || 0).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
      
      {isManuallyDisconnected && (
        <div className="reconnect-prompt">
          <p>Você desconectou do stream de dados.</p>
          <button onClick={reconnect}>Reconectar</button>
        </div>
      )}
    </div>
  );
};

export default LiveRoulettes; 