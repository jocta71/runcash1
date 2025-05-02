import React from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { LockKeyhole } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog';
import { PlanType } from '@/types/plans';

interface BlurredPremiumContentProps {
  /**
   * ID do recurso que está sendo protegido
   */
  featureId: string;
  /**
   * O plano mínimo necessário
   */
  requiredPlan?: PlanType;
  /**
   * Conteúdo que será exibido com blur se o usuário não tiver acesso
   */
  children: React.ReactNode;
  /**
   * Mensagem personalizada para mostrar no hover
   */
  message?: string;
  /**
   * Intensidade do efeito de blur (padrão 5px)
   */
  blurIntensity?: number;
  /**
   * Se deve exibir o botão de upgrade
   */
  showUpgradeOption?: boolean;
}

/**
 * Componente que aplica blur em conteúdo premium, mantendo-o visível mas borrado
 * para usuários que não possuem o plano necessário
 */
const BlurredPremiumContent: React.FC<BlurredPremiumContentProps> = ({
  featureId,
  requiredPlan = PlanType.BASIC,
  children,
  message,
  blurIntensity = 5,
  showUpgradeOption = true
}) => {
  const { hasFeatureAccess, availablePlans, currentPlan } = useSubscription();
  const hasAccess = hasFeatureAccess(featureId);
  
  // Se o usuário tem acesso, renderize o conteúdo normal
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Encontrar o plano mínimo que oferece este recurso
  const planWithFeature = availablePlans.find(plan => 
    plan.allowedFeatures.includes(featureId) && 
    (requiredPlan ? plan.type === requiredPlan : true)
  );
  
  // Mensagem padrão ou personalizada
  const defaultMessage = `Este conteúdo está disponível apenas para assinantes do plano ${planWithFeature?.name || 'superior'}.`;
  const displayMessage = message || defaultMessage;

  return (
    <div className="relative group">
      {/* Conteúdo borrado */}
      <div className={`filter blur-[${blurIntensity}px] pointer-events-none transition-all duration-200`}>
        {children}
      </div>
      
      {/* Overlay apenas visível no hover */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center">
        <LockKeyhole className="h-8 w-8 mb-2 text-vegas-gold" />
        <p className="text-white text-sm text-center px-4 mb-3">{displayMessage}</p>
        
        {showUpgradeOption && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" className="bg-vegas-gold hover:bg-vegas-gold/80 text-black">
                Fazer Upgrade
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-vegas-darkgray text-white border-vegas-black">
              <DialogHeader>
                <DialogTitle>Faça upgrade do seu plano</DialogTitle>
                <DialogDescription className="text-gray-400">
                  Escolha um plano para desbloquear recursos adicionais
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                {availablePlans
                  .filter(plan => plan.type !== PlanType.FREE && (currentPlan ? plan.type > currentPlan.type : true))
                  .map(plan => (
                    <div key={plan.id} className="flex items-center justify-between border border-gray-700 rounded-md p-4">
                      <div>
                        <h4 className="font-medium">{plan.name}</h4>
                        <p className="text-sm text-gray-400">{plan.description}</p>
                        <ul className="mt-2 text-xs text-gray-300">
                          {plan.features.slice(0, 3).map((feature, i) => (
                            <li key={i} className="flex items-center">
                              <span className="mr-1 text-vegas-gold">✓</span> {feature}
                            </li>
                          ))}
                          {plan.features.length > 3 && (
                            <li className="text-gray-400">+ {plan.features.length - 3} mais recursos</li>
                          )}
                        </ul>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-vegas-gold">
                          {plan.price.toLocaleString('pt-BR', { 
                            style: 'currency', 
                            currency: 'BRL' 
                          })}
                          <span className="text-xs text-gray-400">/mês</span>
                        </p>
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="mt-2 bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                        >
                          Escolher
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
};

export default BlurredPremiumContent; 