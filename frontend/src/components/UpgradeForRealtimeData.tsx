import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Clock, Lock, Zap } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { PlanType } from '@/types/plans';

interface UpgradeForRealtimeDataProps {
  className?: string;
}

/**
 * Componente que exibe uma mensagem convidando o usuário a fazer upgrade para ter acesso a dados em tempo real
 */
const UpgradeForRealtimeData: React.FC<UpgradeForRealtimeDataProps> = ({ className }) => {
  const navigate = useNavigate();
  const { currentPlan } = useSubscription();
  
  // Determinar qual plano recomendar com base no plano atual
  const recommendedPlan = currentPlan?.type === PlanType.BASIC ? 'pro' : 'premium';
  
  const handleUpgradeClick = () => {
    navigate('/planos');
  };
  
  return (
    <div className={`flex flex-col items-center justify-center p-6 rounded-lg bg-black/60 backdrop-blur-sm border border-gray-800 ${className}`}>
      <Lock className="w-12 h-12 text-vegas-gold mb-4" />
      
      <h3 className="text-2xl font-bold text-white mb-2">Acesso em Tempo Real Bloqueado</h3>
      
      <p className="text-gray-300 text-center mb-6">
        Para receber dados em tempo real das roletas, é necessário um plano Pro ou Premium.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mb-6">
        <div className="flex flex-col items-center p-4 border border-gray-700 rounded-lg bg-gray-900/50">
          <Clock className="w-8 h-8 text-gray-400 mb-2" />
          <h4 className="font-medium text-white">Plano Atual</h4>
          <p className="text-sm text-gray-400 text-center">
            Dados atualizados a cada 5-10 minutos
          </p>
        </div>
        
        <div className="flex flex-col items-center p-4 border border-vegas-gold/40 rounded-lg bg-vegas-gold/10">
          <Zap className="w-8 h-8 text-vegas-gold mb-2" />
          <h4 className="font-medium text-white">Com Upgrade</h4>
          <p className="text-sm text-gray-400 text-center">
            Dados atualizados instantaneamente
          </p>
        </div>
      </div>
      
      <Button 
        onClick={handleUpgradeClick}
        className="bg-vegas-gold hover:bg-vegas-gold/80 text-black font-medium"
      >
        Ver Planos de Upgrade
      </Button>
    </div>
  );
};

export default UpgradeForRealtimeData; 