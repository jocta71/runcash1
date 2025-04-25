import React, { useState, useEffect } from 'react';
import { realizarDiagnostico } from '../utils/diagnostico';
import styles from '../styles/DiagnosticoModal.module.css';

interface DiagnosticoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DiagnosticoModal: React.FC<DiagnosticoModalProps> = ({ isOpen, onClose }) => {
  const [diagnosticoData, setDiagnosticoData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'endpoints' | 'env' | 'services' | 'errors'>('endpoints');

  useEffect(() => {
    if (isOpen) {
      loadDiagnostico();
    }
  }, [isOpen]);

  const loadDiagnostico = async () => {
    try {
      setLoading(true);
      setError(null);
      const resultado = await realizarDiagnostico();
      setDiagnosticoData(resultado);
    } catch (err: any) {
      setError(`Erro ao carregar diagnóstico: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>Diagnóstico da Aplicação</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        {loading ? (
          <div className={styles.loading}>
            <p>Realizando diagnóstico, aguarde...</p>
            <div className={styles.spinner}></div>
          </div>
        ) : error ? (
          <div className={styles.error}>
            <p>{error}</p>
            <button onClick={loadDiagnostico}>Tentar Novamente</button>
          </div>
        ) : diagnosticoData ? (
          <div className={styles.diagnosticoContainer}>
            <div className={styles.summary}>
              <p>
                <strong>Status:</strong>{' '}
                <span className={`${styles.status} ${styles[diagnosticoData.status]}`}>
                  {diagnosticoData.status === 'success' 
                    ? 'Operacional' 
                    : diagnosticoData.status === 'partial' 
                      ? 'Parcialmente Operacional' 
                      : 'Não Operacional'}
                </span>
              </p>
              <p><strong>Timestamp:</strong> {new Date(diagnosticoData.timestamp).toLocaleString()}</p>
              <p><strong>Domínio:</strong> {diagnosticoData.env.currentDomain}</p>
            </div>

            <div className={styles.tabs}>
              <button 
                className={activeTab === 'endpoints' ? styles.activeTab : ''} 
                onClick={() => setActiveTab('endpoints')}
              >
                Endpoints ({diagnosticoData.endpoints.filter((e: any) => e.status === 'online').length}/{diagnosticoData.endpoints.length})
              </button>
              <button 
                className={activeTab === 'env' ? styles.activeTab : ''} 
                onClick={() => setActiveTab('env')}
              >
                Ambiente
              </button>
              <button 
                className={activeTab === 'services' ? styles.activeTab : ''}
                onClick={() => setActiveTab('services')}
              >
                Serviços
              </button>
              {diagnosticoData.errors.length > 0 && (
                <button 
                  className={`${activeTab === 'errors' ? styles.activeTab : ''} ${styles.errorTab}`} 
                  onClick={() => setActiveTab('errors')}
                >
                  Erros ({diagnosticoData.errors.length})
                </button>
              )}
            </div>

            <div className={styles.tabContent}>
              {activeTab === 'endpoints' && (
                <div>
                  <h3>Status dos Endpoints</h3>
                  <div className={styles.endpointList}>
                    {diagnosticoData.endpoints.map((endpoint: any, index: number) => (
                      <div key={index} className={`${styles.endpointItem} ${styles[endpoint.status]}`}>
                        <span className={styles.endpointName}>{endpoint.endpoint}</span>
                        <span className={styles.endpointStatus}>
                          {endpoint.status === 'online' 
                            ? `✅ Online ${endpoint.responseTime ? `(${endpoint.responseTime}ms)` : ''}` 
                            : endpoint.status === 'offline' 
                              ? '❌ Offline' 
                              : '❓ Desconhecido'}
                        </span>
                        {endpoint.error && <p className={styles.endpointError}>{endpoint.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'env' && (
                <div>
                  <h3>Variáveis de Ambiente</h3>
                  <table className={styles.envTable}>
                    <tbody>
                      <tr>
                        <td>API Base URL:</td>
                        <td>{diagnosticoData.env.apiBaseUrl}</td>
                      </tr>
                      <tr>
                        <td>WebSocket URL:</td>
                        <td>{diagnosticoData.env.wsUrl}</td>
                      </tr>
                      <tr>
                        <td>SSE Server URL:</td>
                        <td>{diagnosticoData.env.sseServerUrl}</td>
                      </tr>
                      <tr>
                        <td>Domínio Atual:</td>
                        <td>{diagnosticoData.env.currentDomain}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'services' && (
                <div>
                  <h3>Status dos Serviços</h3>
                  <div className={styles.serviceItem}>
                    <h4>GlobalRouletteService</h4>
                    <p>
                      <strong>Status:</strong>{' '}
                      {diagnosticoData.services.globalRouletteService.active 
                        ? '✅ Ativo' 
                        : '❌ Inativo'}
                    </p>
                    {diagnosticoData.services.globalRouletteService.active && (
                      <>
                        <p>
                          <strong>Última Atualização:</strong>{' '}
                          {diagnosticoData.services.globalRouletteService.lastFetchTime 
                            ? new Date(diagnosticoData.services.globalRouletteService.lastFetchTime).toLocaleString() 
                            : 'Nunca'}
                        </p>
                        <p>
                          <strong>Quantidade de Dados:</strong>{' '}
                          {diagnosticoData.services.globalRouletteService.dataCount} roletas
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'errors' && (
                <div>
                  <h3>Erros Detectados</h3>
                  <ul className={styles.errorList}>
                    {diagnosticoData.errors.map((error: string, index: number) => (
                      <li key={index} className={styles.errorItem}>{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button onClick={loadDiagnostico} className={styles.refreshButton}>
                Atualizar Diagnóstico
              </button>
              <button 
                onClick={() => {
                  const blob = new Blob([JSON.stringify(diagnosticoData, null, 2)], {type: 'application/json'});
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `runcash-diagnostico-${new Date().toISOString().split('T')[0]}.json`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className={styles.exportButton}
              >
                Exportar JSON
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default DiagnosticoModal; 