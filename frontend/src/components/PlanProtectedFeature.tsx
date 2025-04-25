import React from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { AlertCircle, LockKeyhole } from 'lucide-react';
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

interface PlanProtectedFeatureProps {
  /**
   * ID do recurso que está sendo protegido (deve corresponder aos valores de allowedFeatures nos planos)
   */
  featureId: string;
  /**
   * O plano mínimo necessário para acessar esse recurso
   */
  requiredPlan?: PlanType;
  /**
   * Conteúdo que será exibido se o usuário tiver acesso
   */
  children: React.ReactNode;
  /**
   * Mensagem personalizada para exibir quando o recurso estiver bloqueado
   */
  lockedMessage?: string;
  /**
   * Habilita ou desabilita a visualização de upgrade quando o recurso está bloqueado
   */
  showUpgradeOption?: boolean;
  /**
   * Componente alternativo a mostrar quando bloqueado (em vez de versão borrada)
   * Se não fornecido, será mostrado um placeholder genérico
   */
  placeholderContent?: React.ReactNode;
}

/**
 * Componente que protege recursos com base no plano do usuário.
 * Exibe o conteúdo somente se o usuário tiver o plano necessário,
 * caso contrário, mostra uma mensagem de acesso bloqueado e opções de upgrade.
 */
const PlanProtectedFeature: React.FC<PlanProtectedFeatureProps> = ({
  featureId,
  requiredPlan = PlanType.BASIC,
  children,
  lockedMessage,
  showUpgradeOption = true,
  placeholderContent
}) => {
  const { hasFeatureAccess, availablePlans, currentPlan } = useSubscription();
  const hasAccess = hasFeatureAccess(featureId);
  
  // Se o usuário tem acesso, renderize o conteúdo
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Encontrar o plano mínimo que oferece este recurso
  const planWithFeature = availablePlans.find(plan => 
    plan.allowedFeatures.includes(featureId) && 
    (requiredPlan ? plan.type === requiredPlan : true)
  );
  
  // Mensagem padrão ou personalizada
  const message = lockedMessage || 
    `Este recurso está disponível apenas para assinantes do plano ${planWithFeature?.name || 'superior'}.`;

  // Placeholder genérico se nenhum conteúdo específico for fornecido
  const defaultPlaceholder = (
    <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center space-y-4 p-6 text-center">
      <div className="w-32 h-8 bg-gray-800 rounded animate-pulse"></div>
      <div className="space-y-2 w-full max-w-md">
        <div className="h-4 bg-gray-800 rounded w-3/4 mx-auto"></div>
        <div className="h-4 bg-gray-800 rounded w-1/2 mx-auto"></div>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-md">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-800 rounded animate-pulse"></div>
        ))}
      </div>
      <div className="w-full h-24 bg-gray-800 rounded"></div>
    </div>
  );
  
  // Renderizar o componente de acesso bloqueado
  return (
    <div className="relative border border-dashed border-gray-600 rounded-md">
      <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center p-4 text-center z-10">
        <LockKeyhole className="h-8 w-8 mb-2 text-red-400" />
        <h3 className="text-lg font-semibold mb-1">Recurso Bloqueado</h3>
        <p className="text-sm text-gray-300 mb-4">{message}</p>
        
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
              
              <DialogFooter>
                <p className="text-xs text-gray-400">
                  <AlertCircle className="inline-block h-3 w-3 mr-1" />
                  Os valores serão cobrados mensalmente até o cancelamento.
                </p>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      {/* Usar conteúdo placeholder em vez de versão borrada do conteúdo real */}
      <div className="opacity-60">
        {placeholderContent || defaultPlaceholder}
      </div>
    </div>
  );
};

export default PlanProtectedFeature; 