import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Spinner } from '../components/ui/spinner';
import API_ROUTES from '@/config/api';

interface Subscription {
  subscription_id: string;
  plan_id: string;
  value: number;
  status: string;
  created_at: string;
  payment_id?: string;
  payment_status?: string;
  payment_date?: string;
  payment_method?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  created_at?: string;
}

export default function AccountPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserSubscriptions = async () => {
      if (!user || !user.id) {
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        
        // Buscar assinaturas do usuário no backend do Railway
        const response = await axios.get(`${API_ROUTES.user.subscriptions}?userId=${user.id}`);
        
        if (response.data.success) {
          setSubscriptions(response.data.subscriptions || []);
        } else {
          console.error("Erro ao buscar assinaturas:", response.data.error);
          setError("Não foi possível carregar suas assinaturas. Por favor, tente novamente.");
        }
      } catch (err) {
        console.error("Erro ao carregar dados de assinaturas:", err);
        setError("Erro de conexão ao carregar seus dados.");
      } finally {
        setLoading(false);
      }
    };
    
    if (!authLoading) {
      fetchUserSubscriptions();
    }
  }, [user, authLoading]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const getStatusLabel = (status: string) => {
    const statusMap: Record<string, string> = {
      'ACTIVE': 'Ativa',
      'INACTIVE': 'Inativa',
      'OVERDUE': 'Em atraso',
      'CANCELED': 'Cancelada',
      'PENDING': 'Pendente'
    };
    
    return statusMap[status] || status;
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-500';
      case 'PENDING':
        return 'bg-yellow-500';
      case 'OVERDUE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto text-center py-16">
        <h2 className="text-xl font-semibold mb-4">Carregando informações da conta...</h2>
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-10">
        <div className="bg-white rounded-lg shadow-md p-8 text-center max-w-xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">Acesso Restrito</h2>
          <p className="text-gray-600 mb-6">Você precisa estar logado para acessar sua conta.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-6">
            <Link 
              to="/login" 
              className="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Fazer Login
            </Link>
            <Link 
              to="/register" 
              className="py-2 px-6 border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Minha Conta | RunCash</title>
        <meta name="description" content="Gerencie sua conta e assinaturas no RunCash" />
      </Helmet>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8 pb-4 border-b border-gray-200">Minha Conta</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Informações do usuário */}
          <div className="lg:col-span-4">
            <div className="bg-white rounded-lg shadow-md p-6 h-full">
              <h2 className="text-xl font-semibold mb-6">Informações Pessoais</h2>
              
              <ul className="space-y-4">
                <li>
                  <span className="font-medium text-gray-700">Nome:</span> {user.name}
                </li>
                <li>
                  <span className="font-medium text-gray-700">Email:</span> {user.email}
                </li>
                {user.phone && (
                  <li>
                    <span className="font-medium text-gray-700">Telefone:</span> {user.phone}
                  </li>
                )}
                {user.cpfCnpj && (
                  <li>
                    <span className="font-medium text-gray-700">CPF/CNPJ:</span> {user.cpfCnpj}
                  </li>
                )}
              </ul>
              
              <button 
                className="mt-6 py-2 px-4 border border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white rounded transition-colors text-sm font-medium"
                onClick={() => alert('Funcionalidade em desenvolvimento')}
              >
                Editar Informações
              </button>
            </div>
          </div>
          
          {/* Assinaturas */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <h2 className="text-xl font-semibold mb-6">Minhas Assinaturas</h2>
                
                {error && (
                  <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
                    <p>{error}</p>
                  </div>
                )}
                
                {subscriptions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-6">Você ainda não possui assinaturas ativas.</p>
                    <Link 
                      to="/planos" 
                      className="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Ver Planos Disponíveis
                    </Link>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Plano
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Valor
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Data
                          </th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {subscriptions.map((subscription) => (
                          <tr key={subscription.subscription_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="font-medium capitalize">
                                {subscription.plan_id}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              R$ {subscription.value.toFixed(2).replace('.', ',')}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full text-white ${getStatusColorClass(subscription.status)}`}>
                                {getStatusLabel(subscription.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {formatDate(subscription.created_at)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex space-x-2">
                                <button 
                                  className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                                  onClick={() => window.location.href = `/subscription/${subscription.subscription_id}`}
                                >
                                  Detalhes
                                </button>
                                {subscription.status === 'PENDING' && (
                                  <button 
                                    className="px-3 py-1 text-xs border border-blue-500 text-blue-600 rounded hover:bg-blue-500 hover:text-white transition-colors"
                                    onClick={() => window.location.href = `/payment?subscriptionId=${subscription.subscription_id}`}
                                  >
                                    Pagar
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            
            {/* Histórico de Pagamentos (opcional) */}
            {subscriptions.length > 0 && (
              <div className="bg-white rounded-lg shadow-md mt-6 p-6">
                <h2 className="text-xl font-semibold mb-3">Histórico de Pagamentos</h2>
                <p className="text-gray-500">
                  Para visualizar o histórico completo de pagamentos, 
                  acesse os detalhes da assinatura.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 