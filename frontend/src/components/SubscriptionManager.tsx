import React, { useState, useEffect } from 'react';
import { findAsaasSubscription, cancelAsaasSubscription } from '../integrations/asaas/client';
import { Button, Card, Spinner, Alert, Modal } from 'react-bootstrap';

interface SubscriptionManagerProps {
  subscriptionId: string;
  onSubscriptionCanceled?: () => void;
  onSubscriptionUpdated?: (subscription: any) => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  subscriptionId,
  onSubscriptionCanceled,
  onSubscriptionUpdated
}) => {
  const [subscription, setSubscription] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [cancelLoading, setCancelLoading] = useState<boolean>(false);

  // Carregar detalhes da assinatura
  useEffect(() => {
    loadSubscriptionDetails();
  }, [subscriptionId]);

  const loadSubscriptionDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await findAsaasSubscription(subscriptionId);
      
      if (result && result.subscription) {
        setSubscription(result.subscription);
        setPayments(result.payments || []);
        
        if (onSubscriptionUpdated) {
          onSubscriptionUpdated(result.subscription);
        }
      } else {
        setError('Não foi possível carregar os detalhes da assinatura.');
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes da assinatura:', error);
      setError(error instanceof Error ? error.message : 'Erro ao carregar detalhes da assinatura');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar assinatura
  const handleCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      
      const result = await cancelAsaasSubscription(subscriptionId);
      
      if (result && result.success) {
        // Atualizar dados locais
        setSubscription({ ...subscription, status: 'CANCELLED' });
        
        // Fechar modal
        setShowCancelModal(false);
        
        // Executar callback se existir
        if (onSubscriptionCanceled) {
          onSubscriptionCanceled();
        }
      } else {
        setError('Não foi possível cancelar a assinatura.');
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      setError(error instanceof Error ? error.message : 'Erro ao cancelar a assinatura');
    } finally {
      setCancelLoading(false);
    }
  };

  // Formatar status para exibição
  const formatStatus = (status: string) => {
    const statusMap: Record<string, { text: string, variant: string }> = {
      'ACTIVE': { text: 'Ativa', variant: 'success' },
      'PENDING': { text: 'Pendente', variant: 'warning' },
      'CANCELLED': { text: 'Cancelada', variant: 'danger' },
      'OVERDUE': { text: 'Atrasada', variant: 'danger' },
      'INACTIVE': { text: 'Inativa', variant: 'secondary' }
    };
    
    return statusMap[status] || { text: status, variant: 'secondary' };
  };

  // Formatar data para exibição
  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Formatar valor para exibição
  const formatCurrency = (value: number) => {
    if (typeof value !== 'number') return 'R$ 0,00';
    return `R$ ${value.toFixed(2).replace('.', ',')}`;
  };

  if (loading) {
    return (
      <div className="text-center my-4">
        <Spinner animation="border" />
        <p className="mt-2">Carregando detalhes da assinatura...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        {error}
        <div className="mt-2">
          <Button variant="outline-primary" onClick={loadSubscriptionDetails}>Tentar novamente</Button>
        </div>
      </Alert>
    );
  }

  if (!subscription) {
    return (
      <Alert variant="warning">
        Assinatura não encontrada ou sem detalhes disponíveis.
      </Alert>
    );
  }

  const statusInfo = formatStatus(subscription.status);

  return (
    <div>
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Detalhes da Assinatura</h5>
          <span 
            className={`badge bg-${statusInfo.variant}`}
          >
            {statusInfo.text}
          </span>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <strong>ID da Assinatura:</strong> {subscription.id}
          </div>
          <div className="mb-3">
            <strong>Plano:</strong> {subscription.description || 'Não especificado'}
          </div>
          <div className="mb-3">
            <strong>Valor:</strong> {formatCurrency(subscription.value)}
          </div>
          <div className="mb-3">
            <strong>Ciclo:</strong> {subscription.cycle === 'MONTHLY' ? 'Mensal' : subscription.cycle === 'YEARLY' ? 'Anual' : subscription.cycle}
          </div>
          <div className="mb-3">
            <strong>Próximo Vencimento:</strong> {formatDate(subscription.nextDueDate)}
          </div>
          <div className="mb-3">
            <strong>Forma de Pagamento:</strong> {subscription.billingType === 'PIX' ? 'PIX' : subscription.billingType === 'CREDIT_CARD' ? 'Cartão de Crédito' : subscription.billingType}
          </div>
          
          {subscription.status === 'ACTIVE' && (
            <Button 
              variant="danger" 
              onClick={() => setShowCancelModal(true)}
            >
              Cancelar Assinatura
            </Button>
          )}
        </Card.Body>
      </Card>
      
      {payments.length > 0 && (
        <Card>
          <Card.Header>
            <h5 className="mb-0">Histórico de Pagamentos</h5>
          </Card.Header>
          <Card.Body>
            <div className="table-responsive">
              <table className="table table-striped">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{formatDate(payment.dueDate)}</td>
                      <td>{formatCurrency(payment.value)}</td>
                      <td>
                        <span 
                          className={`badge bg-${
                            payment.status === 'RECEIVED' || payment.status === 'CONFIRMED' 
                              ? 'success' 
                              : payment.status === 'PENDING' 
                                ? 'warning' 
                                : 'danger'
                          }`}
                        >
                          {payment.status === 'RECEIVED' || payment.status === 'CONFIRMED'
                            ? 'Pago' 
                            : payment.status === 'PENDING' 
                              ? 'Pendente' 
                              : payment.status === 'OVERDUE'
                                ? 'Atrasado'
                                : payment.status
                          }
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card.Body>
        </Card>
      )}
      
      {/* Modal de confirmação de cancelamento */}
      <Modal show={showCancelModal} onHide={() => setShowCancelModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cancelar Assinatura</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Tem certeza que deseja cancelar sua assinatura?</p>
          <p><strong>Esta ação não pode ser desfeita.</strong></p>
          
          {error && (
            <Alert variant="danger">
              {error}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCancelModal(false)}>
            Voltar
          </Button>
          <Button 
            variant="danger" 
            onClick={handleCancelSubscription}
            disabled={cancelLoading}
          >
            {cancelLoading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                  className="me-2"
                />
                Cancelando...
              </>
            ) : 'Confirmar Cancelamento'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default SubscriptionManager; 