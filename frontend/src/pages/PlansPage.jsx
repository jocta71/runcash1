import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';

const PlansPage = () => {
  const { user } = useAuth();
  const [plans, setPlans] = useState([]);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [processingPlan, setProcessingPlan] = useState('');

  // Carregar planos disponíveis
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/subscription/plans');
        
        if (response.data.success) {
          setPlans(response.data.data.plans || []);
          setCurrentPlan(response.data.data.currentPlan || null);
        } else {
          toast.error('Erro ao carregar planos');
        }
      } catch (error) {
        console.error('Erro ao buscar planos:', error);
        toast.error('Não foi possível carregar os planos disponíveis');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Iniciar o processo de checkout
  const handleSubscribe = async (planId) => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar um plano');
      return;
    }

    try {
      setProcessingPlan(planId);
      const response = await axios.post('/api/subscription/checkout', { planId });
      
      if (response.data.success && response.data.data.checkoutUrl) {
        setCheckoutUrl(response.data.data.checkoutUrl);
        // Abrir URL de checkout em nova janela ou redirecionar
        window.open(response.data.data.checkoutUrl, '_blank');
      } else {
        toast.error('Erro ao processar assinatura');
      }
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast.error('Não foi possível iniciar o processo de assinatura');
    } finally {
      setProcessingPlan('');
    }
  };

  // Cancelar assinatura atual
  const handleCancelSubscription = async () => {
    if (!confirm('Tem certeza que deseja cancelar sua assinatura?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post('/api/subscription/cancel');
      
      if (response.data.success) {
        toast.success('Assinatura cancelada com sucesso');
        setCurrentPlan(null);
      } else {
        toast.error('Erro ao cancelar assinatura');
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast.error('Não foi possível cancelar sua assinatura');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">Planos de Assinatura</h1>
      
      {currentPlan && (
        <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Seu Plano Atual</h2>
          <p><strong>Plano:</strong> {currentPlan.type}</p>
          <p><strong>Status:</strong> {currentPlan.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}</p>
          <p><strong>Expira em:</strong> {new Date(currentPlan.expiryDate).toLocaleDateString()}</p>
          
          <button 
            onClick={handleCancelSubscription}
            className="mt-4 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
          >
            Cancelar Assinatura
          </button>
        </div>
      )}
      
      <div className="grid md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <div 
            key={plan.id} 
            className="border rounded-lg overflow-hidden shadow-lg transition hover:shadow-xl"
          >
            <div className="p-6 bg-white">
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <p className="text-gray-600 mb-4">{plan.description}</p>
              <div className="text-3xl font-bold mb-4">
                R$ {plan.price.toFixed(2)}
                <span className="text-sm font-normal text-gray-500">/mês</span>
              </div>
              
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={processingPlan === plan.id || (currentPlan && currentPlan.status === 'ACTIVE')}
                className={`w-full py-2 px-4 rounded transition ${
                  processingPlan === plan.id 
                    ? 'bg-gray-400 cursor-not-allowed'
                    : currentPlan && currentPlan.status === 'ACTIVE'
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {processingPlan === plan.id 
                  ? 'Processando...' 
                  : currentPlan && currentPlan.status === 'ACTIVE'
                    ? 'Você já possui um plano ativo'
                    : 'Assinar Agora'}
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {!user && (
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <p className="text-lg">Você precisa estar logado para assinar um plano.</p>
          <a href="/login" className="mt-2 inline-block px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition">
            Fazer Login
          </a>
        </div>
      )}
    </div>
  );
};

export default PlansPage; 