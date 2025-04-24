import React, { useEffect, useState } from 'react';
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
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);
  
  // Efeito para verificar acesso de forma assíncrona
  useEffect(() => {
    const checkAccess = async () => {
      try {
        setCheckingAccess(true);
        const access = await hasFeatureAccess(featureId);
        setHasAccess(access);
      } catch (error) {
        console.error(`Erro ao verificar acesso a feature "${featureId}":`, error);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };
    
    checkAccess();
  }, [featureId, hasFeatureAccess]);
  
  // Exibir um loader enquanto verifica o acesso
  if (checkingAccess) {
    return (
      <div className="w-full h-full min-h-[150px] bg-[#131111] flex flex-col items-center justify-center p-4 rounded-md">
        <div className="h-8 w-8 border-2 border-vegas-gold border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-gray-400 mt-2">Verificando acesso...</p>
      </div>
    );
  }
  
  // Se o usuário tem acesso, renderize o conteúdo
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Encontrar o plano mínimo que oferece este recurso
  const planWithFeature = availablePlans.find(plan => 
    plan.allowedFeatures.includes(featureId) && 
    (requiredPlan ? plan.type === requiredPlan : true)
  );

  // Placeholder mais simples para conteúdo bloqueado
  const simplePlaceholder = (
    <div className="w-full h-full min-h-[150px] bg-[#131111] flex flex-col items-center justify-center p-4 rounded-md">
      <div className="flex flex-col items-center">
        <LockKeyhole className="h-10 w-10 text-red-500 mb-3" />
        <p className="text-center text-gray-400 mb-3 max-w-lg">{lockedMessage || 'Este recurso requer uma assinatura premium.'}</p>
        {showUpgradeOption && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" className="bg-vegas-gold hover:bg-vegas-gold/80 text-black mt-2">
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
    </div>
  );
  
  return (
    <div className="h-full">
      {/* Usar o placeholder personalizado ou o simplificado */}
      {placeholderContent || simplePlaceholder}
    </div>
  );
};

export default PlanProtectedFeature; 