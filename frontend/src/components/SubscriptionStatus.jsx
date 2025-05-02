import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

const SubscriptionStatus = () => {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkSubscription = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/subscription/status');
        
        if (response.data.success) {
          setSubscription(response.data.data);
        } else {
          setError('Não foi possível verificar o status da assinatura');
        }
      } catch (error) {
        console.error('Erro ao verificar assinatura:', error);
        setError('Erro ao verificar o status da assinatura');
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  if (loading) {
    return (
      <div className="p-2 bg-gray-100 rounded-md text-sm flex items-center">
        <span className="animate-pulse text-gray-500">Verificando assinatura...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 bg-red-100 rounded-md text-sm text-red-700">
        {error}
      </div>
    );
  }

  // Se não tem assinatura ou assinatura não está ativa
  if (!subscription || !subscription.hasSubscription) {
    return (
      <div className="p-2 bg-yellow-100 rounded-md text-sm">
        <p className="font-medium text-yellow-800">Sem assinatura ativa</p>
        <p className="text-xs mt-1">Você tem acesso limitado às roletas</p>
        <Link 
          to="/plans" 
          className="mt-1 inline-block text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Ver planos
        </Link>
      </div>
    );
  }

  // Assinatura ativa
  return (
    <div className="p-2 bg-green-100 rounded-md text-sm">
      <p className="font-medium text-green-800">
        {subscription.subscription.planType === 'BASIC' && 'Plano Básico'}
        {subscription.subscription.planType === 'PRO' && 'Plano Profissional'}
        {subscription.subscription.planType === 'PREMIUM' && 'Plano Premium'}
      </p>
      <p className="text-xs mt-1">
        Expira em: {new Date(subscription.subscription.expiryDate).toLocaleDateString()}
      </p>
    </div>
  );
};

export default SubscriptionStatus; 