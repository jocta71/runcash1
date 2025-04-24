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

// Contexto global para gerenciar o estado de recursos bloqueados
export const UpgradeContext = React.createContext<{
  hasBlockedResources: boolean;
  setHasBlockedResources: (value: boolean) => void;
}>({
  hasBlockedResources: false,
  setHasBlockedResources: () => {},
});

// Hook para utilizar o contexto de upgrade
export const useUpgradeContext = () => React.useContext(UpgradeContext);

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
 * caso contrário, mostra um cadeado indicando que está bloqueado.
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
  const { setHasBlockedResources } = useUpgradeContext();
  
  // Quando um recurso bloqueado é renderizado, notificar o contexto
  React.useEffect(() => {
    if (!hasAccess) {
      setHasBlockedResources(true);
    }
  }, [hasAccess, setHasBlockedResources]);
  
  // Se o usuário tem acesso, renderize o conteúdo
  if (hasAccess) {
    return <>{children}</>;
  }
  
  // Placeholder simplificado para conteúdo bloqueado - sem botão de upgrade individual
  const simplePlaceholder = (
    <div className="w-full h-full min-h-[150px] bg-[#131111] flex flex-col items-center justify-center p-4 rounded-md">
      <div className="flex flex-col items-center">
        <LockKeyhole className="h-10 w-10 text-red-500" />
        <p className="text-xs text-gray-400 mt-2 text-center">
          {lockedMessage || `Disponível no plano ${requiredPlan}`}
        </p>
      </div>
    </div>
  );
  
  return (
    <div className="h-full">
      {placeholderContent || simplePlaceholder}
    </div>
  );
};

/**
 * Componente que fornece o diálogo de planos para upgrade
 */
export const UpgradeDialog: React.FC = () => {
  const { availablePlans, currentPlan } = useSubscription();
  
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="default" size="lg" className="bg-vegas-gold hover:bg-vegas-gold/80 text-black fixed bottom-10 left-1/2 transform -translate-x-1/2 z-50 px-8 py-6 rounded-full shadow-lg shadow-vegas-gold/20">
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
  );
};

/**
 * Provider para o contexto de upgrade
 */
export const UpgradeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasBlockedResources, setHasBlockedResources] = React.useState(false);
  
  return (
    <UpgradeContext.Provider value={{ hasBlockedResources, setHasBlockedResources }}>
      {children}
      {hasBlockedResources && <UpgradeDialog />}
    </UpgradeContext.Provider>
  );
};

export default PlanProtectedFeature; 