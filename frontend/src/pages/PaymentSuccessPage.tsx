import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { CheckCircle } from 'react-bootstrap-icons';

/**
 * Página de sucesso após confirmação do pagamento
 */
const PaymentSuccessPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const planId = queryParams.get('plan');
  
  const [countdown, setCountdown] = useState<number>(5);
  
  // Redirecionar automaticamente após 5 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/account');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [navigate]);
  
  return (
    <Container className="my-5">
      <Row className="justify-content-center">
        <Col md={8} lg={6}>
          <Card className="text-center shadow">
            <Card.Body className="py-5">
              <div className="mb-4 text-success">
                <CheckCircle size={80} />
              </div>
              
              <h2 className="mb-3">Pagamento Confirmado!</h2>
              
              <p className="mb-4">
                {planId ? (
                  <>
                    Seu pagamento para o plano <strong>{planId}</strong> foi processado com sucesso.
                    <br />
                    Sua assinatura está agora ativa.
                  </>
                ) : (
                  'Seu pagamento foi processado com sucesso.'
                )}
              </p>
              
              <p className="text-muted mb-4">
                Você será redirecionado para sua conta em {countdown} segundos...
              </p>
              
              <div className="d-grid gap-2 d-md-flex justify-content-md-center">
                <Button 
                  variant="primary" 
                  onClick={() => navigate('/account')}
                >
                  Ir para minha conta
                </Button>
                
                <Button 
                  variant="outline-primary"
                  onClick={() => navigate('/')}
                >
                  Voltar ao início
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default PaymentSuccessPage; 