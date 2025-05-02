import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import LoadingScreen from '../LoadingScreen.jsx';

/**
 * Componente que protege rotas que requerem assinatura ativa
 */
const SubscriptionRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const { isAuthenticated, token } = useAuth();
  const location = useLocation();

  useEffect(() => {
    // Verificar status da assinatura apenas se o usuário estiver autenticado
    const checkSubscription = async () => {
      // Se não estiver autenticado, não é necessário verificar assinatura
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get('/api/subscriptions/status', {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Verificar se a assinatura está ativa
        const subscription = response.data.subscription;
        const isActive = subscription && subscription.active;
        
        setHasActiveSubscription(isActive);
        setLoading(false);
      } catch (error) {
        console.error('Erro ao verificar status da assinatura:', error);
        setHasActiveSubscription(false);
        setLoading(false);
      }
    };

    checkSubscription();
  }, [isAuthenticated, token]);

  // Exibir loading enquanto verifica status
  if (loading) {
    return <LoadingScreen message="Verificando assinatura..." />;
  }

  // Se não estiver autenticado, redirecionar para o login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se não tiver assinatura ativa, redirecionar para a página de assinatura
  if (!hasActiveSubscription) {
    return <Navigate to="/subscription-required" replace />;
  }

  // Se passar por todas as verificações, render o componente protegido
  return children;
};

export default SubscriptionRoute; 