import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useRouter } from 'next/router';

// Criar o contexto
const SubscriptionContext = createContext();

/**
 * Provider para gerenciar o estado de assinatura do usuário
 * Disponibiliza informações sobre o plano atual e permissões de acesso
 */
export const SubscriptionProvider = ({ children }) => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [canAccessRoulettes, setCanAccessRoulettes] = useState(false);
  const router = useRouter();

  // Verificar status de assinatura ao carregar o componente
  useEffect(() => {
    checkSubscription();
  }, []);

  // Função para verificar o status da assinatura
  const checkSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('token');
      
      // Se não houver token, o usuário não está logado
      if (!token) {
        setLoading(false);
        setCanAccessRoulettes(false);
        return;
      }
      
      const response = await axios.get('/api/subscription/status', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      const { subscription, hasActiveSubscription, canAccessRoulettes: hasAccess } = response.data;
      
      setSubscription(subscription);
      setCanAccessRoulettes(hasAccess || false);
      
      // Se o resultado vier com um redirecionamento e não estamos nessa página,
      // podemos armazenar para uso futuro
      if (response.data.redirectTo && router.pathname !== response.data.redirectTo) {
        localStorage.setItem('redirectAfterAuth', response.data.redirectTo);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Erro ao verificar assinatura:', err);
      setError('Não foi possível verificar sua assinatura');
      setLoading(false);
      setCanAccessRoulettes(false);
    }
  };

  // Verificar permissão para acessar um recurso específico
  const checkPermission = (requiredFeature) => {
    // Se estiver carregando, ainda não sabemos
    if (loading) return false;
    
    // Se não tiver assinatura, não tem permissão
    if (!subscription) return false;
    
    // Verificar se a assinatura tem a feature necessária
    return subscription.features.includes(requiredFeature);
  };

  // Redirecionar para página de planos se não tiver permissão
  const requireSubscription = (requiredFeature) => {
    // Se estiver carregando, aguardar
    if (loading) return false;
    
    // Se não tiver a feature necessária, redirecionar para planos
    if (!checkPermission(requiredFeature)) {
      router.push('/planos');
      return false;
    }
    
    return true;
  };

  // Valores disponibilizados pelo contexto
  const value = {
    subscription,
    loading,
    error,
    canAccessRoulettes,
    checkSubscription,
    checkPermission,
    requireSubscription,
    refreshStatus: checkSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Hook personalizado para usar o contexto
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  
  if (!context) {
    throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider');
  }
  
  return context;
};

export default SubscriptionContext; 