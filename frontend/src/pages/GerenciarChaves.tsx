import React, { useState, useEffect } from 'react';
import SubscriptionAccessKey from '../components/SubscriptionAccessKey';
import { Link } from 'react-router-dom';

// Interface para o status da assinatura
interface SubscriptionStatus {
  success: boolean;
  subscription?: {
    status: string;
    plan?: string;
    expiresAt?: string;
  } | null;
  loading: boolean;
  error: string | null;
}

const GerenciarChavesPage: React.FC = () => {
  // Estado para armazenar o status da assinatura
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>({
    success: false,
    subscription: null,
    loading: true,
    error: null
  });

  // Buscar o status da assinatura ao carregar a página
  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const response = await fetch('/api/subscription/status');
        
        if (!response.ok) {
          throw new Error('Falha ao obter status da assinatura');
        }
        
        const data = await response.json();
        
        setSubscriptionStatus({
          success: data.success,
          subscription: data.subscription,
          loading: false,
          error: null
        });
      } catch (error) {
        setSubscriptionStatus({
          success: false,
          subscription: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
      }
    };
    
    fetchSubscriptionStatus();
  }, []);
  
  return (
    <div className="gerenciar-chaves-page">
      <div className="page-header">
        <h1>Gerenciar Chaves de Acesso</h1>
        <Link to="/" className="back-btn">Voltar</Link>
      </div>
      
      <div className="page-content">
        {subscriptionStatus.loading ? (
          <div className="loading-state">
            <p>Verificando status da assinatura...</p>
          </div>
        ) : subscriptionStatus.error ? (
          <div className="error-state">
            <h2>Erro ao verificar assinatura</h2>
            <p>{subscriptionStatus.error}</p>
            <button onClick={() => window.location.reload()}>Tentar novamente</button>
          </div>
        ) : subscriptionStatus.subscription?.status === 'active' ? (
          // Usuário com assinatura ativa
          <div className="subscription-active">
            <div className="plan-info">
              <h2>Assinatura Ativa</h2>
              <p>Plano: {subscriptionStatus.subscription.plan || 'Premium'}</p>
              {subscriptionStatus.subscription.expiresAt && (
                <p>Validade: {new Date(subscriptionStatus.subscription.expiresAt).toLocaleDateString('pt-BR')}</p>
              )}
            </div>
            
            {/* Componente para gerenciar chaves de acesso */}
            <SubscriptionAccessKey />
          </div>
        ) : (
          // Usuário sem assinatura ativa
          <div className="subscription-required">
            <h2>Assinatura Necessária</h2>
            <p>
              Para acessar os dados criptografados da API, você precisa ter uma assinatura ativa.
              Com uma assinatura, você poderá obter uma chave de acesso que permite descriptografar
              os dados da API.
            </p>
            
            <div className="subscription-actions">
              <Link to="/planos" className="btn-subscribe">Ver Planos</Link>
              <Link to="/perfil" className="btn-profile">Gerenciar Assinatura</Link>
            </div>
          </div>
        )}
      </div>
      
      <div className="api-info">
        <h3>Sobre Chaves de Acesso</h3>
        <p>
          As chaves de acesso permitem descriptografar os dados da API que estão publicamente 
          disponíveis, mas criptografados. Apenas usuários com assinatura ativa podem obter
          uma chave de acesso.
        </p>
        <p>
          Cada chave é válida por 7 dias e está vinculada à sua conta. Você pode renovar 
          sua chave a qualquer momento.
        </p>
      </div>
    </div>
  );
};

export default GerenciarChavesPage; 