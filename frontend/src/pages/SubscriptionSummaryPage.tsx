import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Alert, Button, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SubscriptionManager from '../components/SubscriptionManager';

const SubscriptionSummaryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  
  // Estados
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Carregar assinaturas do usuário
  useEffect(() => {
    if (!authLoading && user) {
      loadUserSubscriptions();
    }
  }, [user, authLoading]);
  
  const loadUserSubscriptions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fazer requisição para API para obter assinaturas do usuário
      const response = await fetch(`/api/user-subscriptions?userId=${user?.id}`);
      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
      } else {
        setError(data.error || 'Não foi possível carregar suas assinaturas.');
      }
    } catch (error) {
      console.error('Erro ao carregar assinaturas:', error);
      setError('Ocorreu um erro ao carregar suas assinaturas. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Manipulador para quando uma assinatura é cancelada
  const handleSubscriptionCanceled = () => {
    loadUserSubscriptions();
  };
  
  // Se ainda estiver carregando dados de autenticação ou não tiver usuário, mostrar carregando
  if (authLoading || !user) {
    return (
      <Container className="my-5 text-center">
        <Spinner animation="border" />
        <p>Carregando...</p>
      </Container>
    );
  }
  
  return (
    <Container className="my-5">
      <h2 className="mb-4">Minhas Assinaturas</h2>
      
      {isLoading ? (
        <div className="text-center my-5">
          <Spinner animation="border" />
          <p className="mt-2">Carregando assinaturas...</p>
        </div>
      ) : error ? (
        <Alert variant="danger">
          {error}
          <div className="mt-2">
            <Button variant="outline-primary" onClick={loadUserSubscriptions}>
              Tentar novamente
            </Button>
          </div>
        </Alert>
      ) : subscriptions.length === 0 ? (
        <Card className="text-center p-5">
          <Card.Body>
            <h5 className="mb-3">Você não possui assinaturas ativas</h5>
            <p className="mb-4">Assine um plano para acessar todos os recursos do RunCash.</p>
            <Button 
              variant="primary" 
              onClick={() => navigate('/plans')}
            >
              Ver Planos Disponíveis
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          {subscriptions.map((subscription) => (
            <Col md={12} key={subscription.payment_id || subscription._id}>
              <Card className="mb-4">
                <Card.Header className="bg-dark text-white">
                  <h5 className="mb-0">
                    {subscription.plan_name || `Plano ${subscription.plan_id}`}
                  </h5>
                </Card.Header>
                <Card.Body>
                  {subscription.payment_platform === 'free' ? (
                    <Alert variant="info">
                      Esta é uma assinatura gratuita.
                    </Alert>
                  ) : subscription.payment_id ? (
                    <SubscriptionManager 
                      subscriptionId={subscription.payment_id}
                      onSubscriptionCanceled={handleSubscriptionCanceled}
                    />
                  ) : (
                    <Alert variant="warning">
                      Dados de pagamento não disponíveis para esta assinatura.
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </Container>
  );
};

export default SubscriptionSummaryPage; 