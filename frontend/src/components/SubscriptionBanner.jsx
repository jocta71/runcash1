import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

/**
 * Banner que mostra informações sobre a assinatura do usuário
 * e o tipo de dados de roletas que está acessando
 */
const SubscriptionBanner = () => {
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(true);

  // Verificar status da assinatura ao montar o componente
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        setLoading(true);
        console.log('SubscriptionBanner: Verificando status da assinatura...');
        
        // Buscar status da assinatura do usuário
        const response = await axios.get('/api/subscription/status', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        console.log('SubscriptionBanner: Resposta recebida:', response.data);
        setSubscriptionData(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Erro ao verificar assinatura:', err);
        setError('Não foi possível verificar seu status de assinatura');
        setLoading(false);
      }
    };

    checkSubscription();
  }, []);

  // Determinar se o usuário tem assinatura premium
  const isPremiumUser = subscriptionData?.nivelAcesso === 'premium' || 
                       (subscriptionData?.subscription?.status === 'active') ||
                       (subscriptionData?.hasActiveSubscription === true);
  
  console.log('SubscriptionBanner: Estado atual:', { 
    loading, 
    error, 
    subscriptionData, 
    isPremiumUser,
    isOpen 
  });

  // Se o banner for fechado, não mostrar nada
  if (!isOpen) return null;

  // Se estiver carregando, não mostrar nada
  if (loading) return null;

  // Se ocorreu erro, mostrar mensagem simplificada
  if (error) {
    return (
      <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 7a1 1 0 112 0v5a1 1 0 11-2 0V7zm1 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-yellow-700">
              {error}
            </p>
          </div>
          <div className="ml-auto pl-3">
            <button 
              className="inline-flex text-gray-400 hover:text-gray-500"
              onClick={() => setIsOpen(false)}
            >
              <span className="sr-only">Fechar</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Se não há status ou o usuário está usando dados simulados
  if (!isPremiumUser) {
    return (
      <div className="bg-blue-100 border-l-4 border-blue-500 p-4 mb-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700 font-medium">
              Você está visualizando dados de demonstração
            </p>
            <p className="text-sm text-blue-700 mt-1">
              Os dados das roletas exibidos são simulados. Para acessar dados reais, assine nosso plano premium.
            </p>
            <div className="mt-2">
              <Link 
                to="/planos" 
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Ver planos
              </Link>
            </div>
          </div>
          <div className="ml-auto pl-3">
            <button 
              className="inline-flex text-gray-400 hover:text-gray-500"
              onClick={() => setIsOpen(false)}
            >
              <span className="sr-only">Fechar</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Usuário premium, mostrar confirmação
  return (
    <div className="bg-green-100 border-l-4 border-green-500 p-4 mb-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-500" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-700 font-medium">
            Assinatura Premium Ativa
          </p>
          <p className="text-sm text-green-700 mt-1">
            Você está visualizando dados reais das roletas. Aproveite!
          </p>
        </div>
        <div className="ml-auto pl-3">
          <button 
            className="inline-flex text-gray-400 hover:text-gray-500"
            onClick={() => setIsOpen(false)}
          >
            <span className="sr-only">Fechar</span>
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionBanner; 