import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { PlanType } from '@/types/plans';
import axios from 'axios';

// Tipos para o contexto
interface SubscriptionContextType {
  availablePlans: PlanType[];
  currentPlan: PlanType | null;
  loading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  cancelSubscription: (reason?: string) => Promise<void>;
}

// Planos disponíveis
const AVAILABLE_PLANS: PlanType[] = [
  {
    id: 'basic',
    name: 'Básico',
    description: 'Para quem está começando a controlar suas finanças',
    price: 3,
    interval: 'monthly',
    features: [
      'Controle de despesas e receitas',
      'Categorização automática',
      'Relatórios básicos',
      'Lembretes de contas a pagar'
    ]
  },
  {
    id: 'pro',
    name: 'Profissional',
    description: 'Para quem deseja um controle financeiro avançado',
    price: 30,
    interval: 'monthly',
    features: [
      'Todas as funcionalidades do plano Básico',
      'Planejamento financeiro personalizado',
      'Relatórios avançados e projeções',
      'Exportação de dados em múltiplos formatos',
      'Suporte prioritário',
      'Sincronização com instituições financeiras'
    ]
  }
];

// Criar contexto
const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// Provedor do contexto
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanType | null>(null);
  
  // Função para buscar informações da assinatura
  const fetchSubscriptionInfo = async () => {
    if (!isAuthenticated || !user) {
      setCurrentPlan(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Obter a API base URL do .env
      const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';
      
      // Fazer requisição para obter a assinatura atual
      const response = await axios.get(`${API_URL}/subscriptions/current`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data.success && response.data.subscription) {
        // Encontrar o plano correspondente nos planos disponíveis
        const plan = AVAILABLE_PLANS.find(
          (p) => p.id === response.data.subscription.planId
        );
        
        // Definir o plano atual
        setCurrentPlan(plan || null);
      } else {
        setCurrentPlan(null);
      }
    } catch (err) {
      console.error('Erro ao buscar informações da assinatura:', err);
      setError('Não foi possível carregar as informações da assinatura.');
      // Em caso de erro, não definimos o plano atual como null para preservar os dados existentes
    } finally {
      setLoading(false);
    }
  };
  
  // Função para atualizar a assinatura
  const refreshSubscription = async () => {
    await fetchSubscriptionInfo();
  };
  
  // Função para cancelar assinatura
  const cancelSubscription = async (reason?: string) => {
    if (!isAuthenticated || !user) {
      throw new Error('Usuário não autenticado');
    }
    
    try {
      setLoading(true);
      
      // Obter a API base URL do .env
      const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';
      
      // Enviar solicitação para cancelar a assinatura
      const response = await axios.post(
        `${API_URL}/subscriptions/cancel`,
        { reason: reason || 'Não especificado' },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      );
      
      if (response.data.success) {
        // Atualizar o estado local após o cancelamento
        setCurrentPlan(null);
        return;
      } else {
        throw new Error(response.data.message || 'Falha ao cancelar assinatura');
      }
    } catch (err: any) {
      console.error('Erro ao cancelar assinatura:', err);
      setError('Não foi possível cancelar a assinatura.');
      throw new Error(err.response?.data?.message || err.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // Buscar assinatura ao carregar o componente ou quando o usuário mudar
  useEffect(() => {
    fetchSubscriptionInfo();
  }, [isAuthenticated, user]);

  // Valor do contexto
  const value = {
    availablePlans: AVAILABLE_PLANS,
    currentPlan,
    loading,
    error,
    refreshSubscription,
    cancelSubscription
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

// Hook para usar o contexto
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription deve ser usado dentro de um SubscriptionProvider');
  }
  return context;
}; 