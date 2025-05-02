import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole, CreditCard, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

interface SubscriptionRequiredProps {
  title?: string;
  message?: string;
  requiresType?: string;
  currentType?: string;
}

const SubscriptionRequired: React.FC<SubscriptionRequiredProps> = ({
  title = 'Assinatura Necessária',
  message = 'Este conteúdo está disponível apenas para usuários com assinatura ativa.',
  requiresType,
  currentType
}) => {
  const navigate = useNavigate();

  const handleRedirectToPlans = () => {
    navigate('/plans');
  };

  return (
    <div className="flex items-center justify-center min-h-[400px] px-4">
      <Card className="w-full max-w-md border-2 border-red-300">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 bg-red-100 p-3 rounded-full w-16 h-16 flex items-center justify-center">
            <LockKeyhole className="h-8 w-8 text-red-500" />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{message}</CardDescription>
        </CardHeader>
        
        <CardContent>
          {requiresType && (
            <div className="mb-4 p-4 bg-gray-100 rounded-md">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <p className="font-medium text-gray-700">Informações de acesso:</p>
              </div>
              <div className="text-sm space-y-1 pl-7">
                <p>Plano necessário: <span className="font-semibold">{requiresType}</span></p>
                {currentType && (
                  <p>Seu plano atual: <span className="font-semibold">{currentType}</span></p>
                )}
              </div>
            </div>
          )}
          
          <p className="text-center text-sm text-gray-600 mt-4">
            Adquira uma assinatura para desbloquear todos os recursos e dados das roletas em tempo real.
          </p>
        </CardContent>
        
        <CardFooter className="flex-col space-y-2">
          <Button onClick={handleRedirectToPlans} className="w-full" size="lg">
            <CreditCard className="mr-2 h-4 w-4" />
            Ver Planos e Preços
          </Button>
          <Button onClick={() => navigate('/')} variant="outline" className="w-full">
            Voltar para Página Inicial
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default SubscriptionRequired; 