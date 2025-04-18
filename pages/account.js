import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Account.module.css'; // Este arquivo CSS precisará ser criado posteriormente

export default function AccountPage() {
  const [user, setUser] = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Verificar se o usuário está autenticado
    const checkAuth = async () => {
      try {
        // Substitua por sua própria lógica de autenticação
        const token = localStorage.getItem('authToken');
        
        if (!token) {
          setError('Não autenticado');
          setLoading(false);
          return;
        }

        // Buscar dados do usuário do servidor
        const userResponse = await fetch('/api/user', {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!userResponse.ok) {
          throw new Error('Falha ao carregar dados do usuário');
        }
        
        const userData = await userResponse.json();
        setUser(userData);
        
        // Buscar assinaturas do usuário
        if (userData.id) {
          const subscriptionsResponse = await fetch(`/api/user-subscriptions?userId=${userData.id}`);
          
          if (!subscriptionsResponse.ok) {
            throw new Error('Falha ao carregar assinaturas');
          }
          
          const subscriptionsData = await subscriptionsResponse.json();
          setSubscriptions(subscriptionsData.subscriptions || []);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Erro ao carregar dados da conta:', err);
        setError(err.message);
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  const getStatusLabel = (status) => {
    const statusMap = {
      'ACTIVE': 'Ativa',
      'INACTIVE': 'Inativa',
      'OVERDUE': 'Em atraso',
      'CANCELED': 'Cancelada',
      'PENDING': 'Pendente'
    };
    
    return statusMap[status] || status;
  };

  if (loading) {
    return (
      <div className="container text-center py-5">
        <h2>Carregando informações da conta...</h2>
        <div className="spinner-border mt-3" role="status">
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error === 'Não autenticado') {
    return (
      <div className="container py-5">
        <div className="card text-center shadow-sm">
          <div className="card-body p-5">
            <h2 className="card-title mb-4">Acesso Restrito</h2>
            <p className="card-text">Você precisa estar logado para acessar sua conta.</p>
            <div className="mt-4">
              <Link href="/login" className="btn btn-primary me-3">
                Fazer Login
              </Link>
              <Link href="/register" className="btn btn-outline-secondary">
                Criar Conta
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-5">
        <div className="alert alert-danger" role="alert">
          <h4 className="alert-heading">Erro ao carregar dados!</h4>
          <p>{error}</p>
          <hr />
          <p className="mb-0">Por favor, tente novamente mais tarde ou entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Minha Conta | RunCash</title>
        <meta name="description" content="Gerencie sua conta e assinaturas no RunCash" />
      </Head>

      <div className="container py-5">
        <h1 className="mb-5 border-bottom pb-3">Minha Conta</h1>
        
        <div className="row">
          {/* Informações do usuário */}
          <div className="col-lg-4 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">
                <h2 className="card-title h5 mb-4">Informações Pessoais</h2>
                
                {user && (
                  <ul className="list-unstyled">
                    <li className="mb-3">
                      <strong>Nome:</strong> {user.name}
                    </li>
                    <li className="mb-3">
                      <strong>Email:</strong> {user.email}
                    </li>
                    {user.phone && (
                      <li className="mb-3">
                        <strong>Telefone:</strong> {user.phone}
                      </li>
                    )}
                    {user.cpfCnpj && (
                      <li className="mb-3">
                        <strong>CPF/CNPJ:</strong> {user.cpfCnpj}
                      </li>
                    )}
                  </ul>
                )}
                
                <button className="btn btn-outline-primary btn-sm mt-3">
                  Editar Informações
                </button>
              </div>
            </div>
          </div>
          
          {/* Assinaturas */}
          <div className="col-lg-8">
            <div className="card shadow-sm">
              <div className="card-body">
                <h2 className="card-title h5 mb-4">Minhas Assinaturas</h2>
                
                {subscriptions.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted mb-4">Você ainda não possui assinaturas ativas.</p>
                    <Link href="/planos" className="btn btn-primary">
                      Ver Planos Disponíveis
                    </Link>
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover">
                      <thead className="table-light">
                        <tr>
                          <th>Plano</th>
                          <th>Valor</th>
                          <th>Status</th>
                          <th>Data</th>
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subscriptions.map((subscription) => (
                          <tr key={subscription.subscription_id}>
                            <td>
                              <strong className="text-capitalize">
                                {subscription.plan_id}
                              </strong>
                            </td>
                            <td>
                              R$ {parseFloat(subscription.value).toFixed(2).replace('.', ',')}
                            </td>
                            <td>
                              <span className={`badge bg-${
                                subscription.status === 'ACTIVE' ? 'success' : 
                                subscription.status === 'PENDING' ? 'warning' : 
                                'secondary'
                              }`}>
                                {getStatusLabel(subscription.status)}
                              </span>
                            </td>
                            <td>{formatDate(subscription.created_at)}</td>
                            <td>
                              <div className="btn-group">
                                <Link 
                                  href={`/subscription/${subscription.subscription_id}`}
                                  className="btn btn-sm btn-outline-secondary"
                                >
                                  Detalhes
                                </Link>
                                {subscription.status === 'PENDING' && (
                                  <button 
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => {
                                      window.location.href = `/payment?subscriptionId=${subscription.subscription_id}`;
                                    }}
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
              <div className="card shadow-sm mt-4">
                <div className="card-body">
                  <h2 className="card-title h5 mb-3">Histórico de Pagamentos</h2>
                  <p className="text-muted">
                    Para visualizar o histórico completo de pagamentos, 
                    acesse os detalhes da assinatura.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
} 