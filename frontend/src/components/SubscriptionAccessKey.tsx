import React, { useState, useEffect } from 'react';
import { cryptoService } from '../utils/crypto-utils';

interface AccessKeyStatus {
  loading: boolean;
  error: string | null;
  accessKey: string | null;
  expiresAt: number | null;
}

/**
 * Componente para gerenciar a chave de acesso do usuário
 * Permite obter uma nova chave de acesso ou ver o status da atual
 */
const SubscriptionAccessKey: React.FC = () => {
  // Estado para armazenar o status da chave de acesso
  const [status, setStatus] = useState<AccessKeyStatus>({
    loading: false,
    error: null,
    accessKey: null,
    expiresAt: null
  });
  
  // Estado para controlar a visibilidade da chave
  const [showKey, setShowKey] = useState(false);
  
  // Verificar se já existe uma chave de acesso
  useEffect(() => {
    // Verificar se o usuário já tem uma chave de acesso
    const hasKey = cryptoService.hasAccessKey();
    
    if (hasKey) {
      setStatus(prevState => ({
        ...prevState,
        accessKey: 'chave-existente-mascarada',
      }));
    }
  }, []);
  
  /**
   * Obter uma nova chave de acesso da API
   */
  const fetchAccessKey = async () => {
    setStatus(prevState => ({
      ...prevState,
      loading: true,
      error: null
    }));
    
    try {
      // Fazer requisição para obter a chave de acesso
      const response = await fetch('/api/subscription/access-key');
      
      if (!response.ok) {
        // Se a resposta não for ok, verificar o tipo de erro
        if (response.status === 403) {
          throw new Error('Você precisa ter uma assinatura ativa para obter uma chave de acesso.');
        } else {
          throw new Error('Não foi possível obter a chave de acesso. Tente novamente mais tarde.');
        }
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Armazenar a chave de acesso no serviço de criptografia
        cryptoService.setAccessKey(data.accessKey);
        
        // Atualizar o estado
        setStatus({
          loading: false,
          error: null,
          accessKey: data.accessKey,
          expiresAt: data.expiresAt
        });
      } else {
        throw new Error(data.message || 'Não foi possível obter a chave de acesso.');
      }
    } catch (error) {
      console.error('Erro ao obter chave de acesso:', error);
      
      // Atualizar o estado com o erro
      setStatus(prevState => ({
        ...prevState,
        loading: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }));
    }
  };
  
  /**
   * Limpar a chave de acesso
   */
  const clearAccessKey = () => {
    // Limpar a chave de acesso no serviço de criptografia
    cryptoService.clearAccessKey();
    
    // Atualizar o estado
    setStatus({
      loading: false,
      error: null,
      accessKey: null,
      expiresAt: null
    });
  };
  
  /**
   * Formatar a data de expiração
   */
  const formatExpirationDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  /**
   * Mascarar a chave de acesso para exibição
   */
  const getMaskedKey = (key: string) => {
    if (!key) return '';
    if (key === 'chave-existente-mascarada') return '••••••••••••••••••••••••••••••••';
    
    // Mostrar apenas os primeiros e últimos 5 caracteres
    const firstPart = key.substring(0, 5);
    const lastPart = key.substring(key.length - 5);
    return showKey ? key : `${firstPart}...${lastPart}`;
  };
  
  return (
    <div className="subscription-access-key-container">
      <h2>Chave de Acesso à API</h2>
      
      <div className="access-key-description">
        <p>
          A chave de acesso permite descriptografar os dados da API. 
          Apenas usuários com assinatura ativa podem obter uma chave de acesso.
        </p>
      </div>
      
      {status.error && (
        <div className="error-message">
          <p>{status.error}</p>
        </div>
      )}
      
      {status.accessKey ? (
        <div className="access-key-info">
          <h3>Sua Chave de Acesso</h3>
          
          <div className="key-display">
            <code>{getMaskedKey(status.accessKey)}</code>
            <button 
              className="toggle-visibility-btn"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
          
          {status.expiresAt && (
            <p className="expiration-info">
              Esta chave expira em: {formatExpirationDate(status.expiresAt)}
            </p>
          )}
          
          <div className="key-actions">
            <button 
              className="clear-key-btn"
              onClick={clearAccessKey}
            >
              Remover Chave
            </button>
            
            <button 
              className="refresh-key-btn"
              onClick={fetchAccessKey}
              disabled={status.loading}
            >
              {status.loading ? 'Carregando...' : 'Obter Nova Chave'}
            </button>
          </div>
        </div>
      ) : (
        <div className="get-access-key">
          <p>Você ainda não tem uma chave de acesso.</p>
          
          <button 
            className="get-key-btn"
            onClick={fetchAccessKey}
            disabled={status.loading}
          >
            {status.loading ? 'Carregando...' : 'Obter Chave de Acesso'}
          </button>
        </div>
      )}
      
      <div className="access-key-info-note">
        <p>
          <strong>Nota:</strong> A chave de acesso é válida por 7 dias. 
          Após esse período, você precisará obter uma nova chave.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionAccessKey; 