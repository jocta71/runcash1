import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckCircle } from 'react-bootstrap-icons';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <div className="container my-5">
      <div className="flex justify-center">
        <div className="w-full max-w-lg">
          <Card className="shadow">
            <CardContent className="py-5 text-center">
              <div className="mb-4 text-green-500">
                <CheckCircle size={80} />
              </div>
              
              <h2 className="mb-3 text-2xl font-bold">Pagamento Confirmado!</h2>
              
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
              
              <p className="text-muted mb-4 text-gray-500">
                Você será redirecionado para sua conta em {countdown} segundos...
              </p>
              
              <div className="flex justify-center gap-4">
                <Button 
                  variant="default" 
                  onClick={() => navigate('/account')}
                >
                  Ir para minha conta
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => navigate('/')}
                >
                  Voltar ao início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage; 