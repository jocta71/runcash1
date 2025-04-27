import React from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PremiumDataAlertProps {
  featureId?: string;
  className?: string;
}

/**
 * Componente que exibe um aviso para usuários sem acesso premium
 * informando sobre a necessidade de upgrade para acessar dados em tempo real
 */
const PremiumDataAlert: React.FC<PremiumDataAlertProps> = ({
  featureId = 'realtime-data-access',
  className = '',
}) => {
  const { hasFeatureAccess, currentPlan } = useSubscription();
  const navigate = useNavigate();
  
  // Se o usuário tem acesso, não mostrar nada
  if (hasFeatureAccess(featureId)) {
    return null;
  }
  
  // Função para redirecionar para a página de planos
  const handleUpgradeClick = () => {
    navigate('/plans');
  };
  
  return (
    <Alert 
      variant="destructive" 
      className={`mb-4 border-[#FF5555] bg-[#FF555522] ${className}`}
    >
      <div className="flex items-center space-x-2">
        <Lock className="h-5 w-5 text-[#FF5555]" />
        <AlertTitle className="font-bold text-[#FF8888]">
          Acesso Limitado
        </AlertTitle>
      </div>
      
      <AlertDescription className="mt-2">
        <p className="mb-2">
          Você está usando o plano {currentPlan?.name || 'Gratuito'} que não inclui acesso aos dados em tempo real.
          Faça upgrade para visualizar atualizações instantâneas das roletas.
        </p>
        
        <div className="flex justify-center mt-3">
          <Button 
            variant="outline" 
            className="border-[#FF5555] text-[#FF8888] hover:bg-[#FF555533] hover:text-[#FFAAAA]"
            onClick={handleUpgradeClick}
          >
            Ver Planos Disponíveis
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default PremiumDataAlert; 