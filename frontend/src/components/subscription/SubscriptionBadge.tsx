import React, { useState, useEffect } from 'react';
import { Crown, Rocket, ChevronsUp } from 'lucide-react';
import GlobalRouletteDataService from '@/services/GlobalRouletteDataService';
import EventService from '@/services/EventService';
import { Button } from "@/components/ui/button";
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface SubscriptionBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showUpgradeButton?: boolean;
}

const SubscriptionBadge: React.FC<SubscriptionBadgeProps> = ({
  size = 'md',
  showUpgradeButton = true
}) => {
  const [plan, setPlan] = useState<string>('basic');
  const [isLoaded, setIsLoaded] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Tamanhos com base no parâmetro size
  const badgeSizes = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };
  
  // Cores e ícones com base no plano
  const planStyles = {
    basic: {
      bgColor: 'bg-gray-200',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-300',
      icon: null
    },
    premium: {
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-700',
      borderColor: 'border-blue-300',
      icon: <Crown className="w-4 h-4 mr-1" />
    },
    vip: {
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-700',
      borderColor: 'border-purple-300',
      icon: <Rocket className="w-4 h-4 mr-1" />
    }
  };
  
  useEffect(() => {
    // Obter informações de assinatura do serviço 
    // Corrigido para usar método estático
    const dataService = GlobalRouletteDataService.getInstance();
    const subscriptionInfo = dataService.getSubscriptionInfo();
    
    if (subscriptionInfo) {
      setPlan(subscriptionInfo.plan);
    }
    
    setIsLoaded(true);
    
    // Escutar eventos de atualização de assinatura
    const handleSubscriptionUpdate = (data: any) => {
      if (data && data.plan) {
        setPlan(data.plan);
      }
    };
    
    EventService.on('subscription:updated', handleSubscriptionUpdate);
    
    return () => {
      EventService.off('subscription:updated', handleSubscriptionUpdate);
    };
  }, []);
  
  // Não mostrar nada até termos os dados carregados
  if (!isLoaded) {
    return null;
  }
  
  const currentStyle = planStyles[plan as keyof typeof planStyles] || planStyles.basic;
  
  return (
    <div className="flex flex-col items-start">
      <div className={`
        flex items-center rounded-full
        ${badgeSizes[size]}
        ${currentStyle.bgColor}
        ${currentStyle.textColor}
        border ${currentStyle.borderColor}
      `}>
        {currentStyle.icon}
        <span className="font-medium">
          {plan === 'basic' ? 'Plano Básico' : plan === 'premium' ? 'Premium' : 'VIP'}
        </span>
      </div>
      
      {showUpgradeButton && plan === 'basic' && user && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 p-0 h-auto text-xs text-blue-600 hover:text-blue-800 hover:bg-transparent flex items-center"
          onClick={() => navigate('/assinatura')}
        >
          <ChevronsUp className="w-3 h-3 mr-1" />
          Fazer upgrade
        </Button>
      )}
    </div>
  );
};

export default SubscriptionBadge; 