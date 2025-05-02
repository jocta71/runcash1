import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './PlansPage.css';

const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const { isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/plans');
        setPlans(response.data.data || []);
        setLoading(false);
      } catch (err) {
        setError('Falha ao carregar planos. Tente novamente mais tarde.');
        setLoading(false);
        console.error('Erro ao buscar planos:', err);
      }
    };
    
    fetchPlans();
  }, []);
  
  const handleSelectPlan = (plan) => {
    setSelectedPlan(plan);
  };
  
  const handleSubscribe = async () => {
    if (!selectedPlan) return;
    
    try {
      // Verificar se usuário está logado
      if (!isAuthenticated) {
        // Salvar plano selecionado no localStorage para recuperar após login
        localStorage.setItem('selectedPlanId', selectedPlan.id);
        // Redirecionar para login
        navigate('/login?redirect=plans');
        return;
      }
      
      setLoading(true);
      
      // Criar assinatura no backend
      const response = await axios.post('/api/subscriptions/create', {
        planId: selectedPlan.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      // Verificar se usuário já tem assinatura
      if (response.data.alreadySubscribed) {
        navigate('/dashboard/subscription');
        return;
      }
      
      // Redirecionar para checkout da Asaas
      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Não foi possível gerar o link de pagamento.');
        setLoading(false);
      }
    } catch (err) {
      setError('Falha ao iniciar assinatura. Tente novamente.');
      setLoading(false);
      console.error('Erro ao criar assinatura:', err);
    }
  };
  
  // Verificar se tem um plano salvo no localStorage (após retorno do login)
  useEffect(() => {
    const savedPlanId = localStorage.getItem('selectedPlanId');
    
    if (savedPlanId && plans.length > 0 && isAuthenticated) {
      const plan = plans.find(p => p.id === savedPlanId);
      if (plan) {
        setSelectedPlan(plan);
        // Limpar plano salvo
        localStorage.removeItem('selectedPlanId');
        
        // Se estiver logado e tiver plano salvo, iniciar assinatura automaticamente
        handleSubscribe();
      }
    }
  }, [plans, isAuthenticated]);
  
  if (loading) return (
    <div className="loading-container">
      <div className="loading-spinner"></div>
      <p>Carregando planos...</p>
    </div>
  );
  
  if (error) return (
    <div className="error-container">
      <div className="error-message">
        <h3>Erro</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Tentar novamente</button>
      </div>
    </div>
  );
  
  return (
    <div className="plans-container">
      <h1>Escolha seu Plano</h1>
      <p className="subtitle">Acesse recursos exclusivos com uma assinatura premium</p>
      
      <div className="plans-grid">
        {plans.map(plan => (
          <div 
            key={plan.id} 
            className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
            onClick={() => handleSelectPlan(plan)}
          >
            <div className="plan-header">
              <h2>{plan.name}</h2>
              <div className="price-container">
                <span className="currency">R$</span>
                <span className="price">{plan.value.toFixed(2)}</span>
                <span className="period">/{plan.billingCycle === 'MONTHLY' ? 'mês' : 'ano'}</span>
              </div>
            </div>
            
            <div className="plan-features">
              <ul>
                {plan.features.map((feature, index) => (
                  <li key={index}>
                    <span className="feature-icon">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            
            <button 
              className={`select-button ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleSelectPlan(plan);
              }}
            >
              {selectedPlan?.id === plan.id ? 'Selecionado ✓' : 'Selecionar'}
            </button>
          </div>
        ))}
      </div>
      
      {selectedPlan && (
        <div className="subscription-summary">
          <h3>Resumo da Assinatura</h3>
          <p><strong>Plano:</strong> {selectedPlan.name}</p>
          <p><strong>Valor:</strong> R$ {selectedPlan.value.toFixed(2)}/{selectedPlan.billingCycle === 'MONTHLY' ? 'mês' : 'ano'}</p>
          <p><strong>Período:</strong> {selectedPlan.billingCycle === 'MONTHLY' ? 'Mensal' : 'Anual'} (renovação automática)</p>
          
          <button 
            className="subscribe-button"
            onClick={handleSubscribe}
            disabled={loading}
          >
            {loading ? 'Processando...' : 'Assinar Agora'}
          </button>
          
          <p className="disclaimer">
            Ao assinar, você concorda com nossos termos de serviço e política de privacidade.
            Você pode cancelar sua assinatura a qualquer momento.
          </p>
        </div>
      )}
    </div>
  );
};

export default PlansPage; 