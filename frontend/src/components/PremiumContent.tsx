import React, { ReactNode, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { LockKeyhole, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog';
import { PlanType } from '@/types/plans';

interface PremiumContentProps {
  /**
   * ID do recurso que está sendo protegido
   */
  featureId: string;
  /**
   * O plano mínimo necessário
   */
  requiredPlan?: PlanType;
  /**
   * Conteúdo premium a ser protegido
   */
  children: ReactNode;
  /**
   * Conteúdo alternativo para exibir quando o usuário não tem acesso
   * Se não fornecido, o conteúdo original será exibido com blur
   */
  fallbackContent?: ReactNode;
  /**
   * Mensagem de upgrade personalizada
   */
  upgradeMessage?: string;
  /**
   * Se deve mostrar o botão para alternar visibilidade (para visualização temporária)
   */
  allowPeek?: boolean;
  /**
   * Tipo de visualização para não-assinantes
   * - blur: aplica efeito de blur no conteúdo original
   * - placeholder: mostra um conteúdo genérico de placeholder
   * - fallback: mostra o fallbackContent fornecido
   * - hidden: esconde completamente o conteúdo
   */
  nonPremiumView?: 'blur' | 'placeholder' | 'fallback' | 'hidden';
  /**
   * Intensidade do blur (1-10)
   */
  blurIntensity?: number;
  /**
   * Se deve exibir o botão de upgrade
   */
  showUpgradeButton?: boolean;
}

/**
 * Componente que protege conteúdo premium com base no plano do usuário
 */
const PremiumContent: React.FC<PremiumContentProps> = ({
  featureId,
  requiredPlan = PlanType.BASIC,
  children,
  fallbackContent,
  upgradeMessage,
  allowPeek = false,
  nonPremiumView = 'blur',
  blurIntensity = 5,
  showUpgradeButton = true
}) => {
  const { hasFeatureAccess, availablePlans, currentPlan } = useSubscription();
  const [isPeeking, setIsPeeking] = useState(false);
  
  const hasAccess = hasFeatureAccess(featureId);
  
  // Se usuário tem acesso, mostrar conteúdo normal
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
  const displayMessage = upgradeMessage || defaultMessage;
  
  // Toggle temporário de visibilidade
  const togglePeek = () => {
    setIsPeeking(!isPeeking);
  };
  
  // Placeholder genérico para quando não há fallback content
  const defaultPlaceholder = (
    <div className="w-full h-full min-h-[100px] bg-gray-800/30 rounded-md border border-dashed border-gray-600 flex flex-col items-center justify-center p-4">
      <LockKeyhole className="h-6 w-6 mb-2 text-gray-400" />
      <div className="text-sm text-gray-400 text-center">
        Conteúdo disponível apenas para assinantes
      </div>
    </div>
  );
  
  // Decidir qual conteúdo mostrar baseado no tipo de visualização
  const renderContent = () => {
    // Se estiver no modo "peek", mostrar o conteúdo original
    if (allowPeek && isPeeking) {
      return (
        <div className="relative">
          {children}
          <div className="absolute top-2 right-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 w-8 p-0 bg-black/40 hover:bg-black/60 rounded-full" 
              onClick={togglePeek}
            >
              <EyeOff size={16} className="text-white" />
            </Button>
          </div>
        </div>
      );
    }
    
    // Tipos de visualização para usuários sem acesso
    switch (nonPremiumView) {
      case 'blur':
        return (
          <div className="relative group/premium">
            {/* Conteúdo com blur */}
            <div 
              className={`filter blur-[${blurIntensity}px] select-none transition-all group-hover/premium:blur-[${blurIntensity * 1.5}px]`}
              style={{ 
                pointerEvents: 'none',
                userSelect: 'none'
              }}
            >
              {children}
            </div>
            
            {/* Overlay com mensagem e botão de upgrade */}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/premium:opacity-100 transition-opacity flex flex-col items-center justify-center px-4 py-8">
              <LockKeyhole className="h-8 w-8 mb-2 text-vegas-gold" />
              <p className="text-sm text-center text-white mb-4">{displayMessage}</p>
              
              {showUpgradeButton && renderUpgradeButton()}
              
              {allowPeek && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={togglePeek} 
                  className="mt-2 bg-transparent border-white/30 text-white/80 hover:bg-white/10"
                >
                  <Eye size={14} className="mr-1" /> Visualizar temporariamente
                </Button>
              )}
            </div>
          </div>
        );
        
      case 'placeholder':
        return (
          <div className="relative">
            {defaultPlaceholder}
            {showUpgradeButton && (
              <div className="absolute inset-0 flex items-center justify-center">
                {renderUpgradeButton()}
              </div>
            )}
          </div>
        );
        
      case 'fallback':
        return fallbackContent || defaultPlaceholder;
        
      case 'hidden':
        return (
          <div className="w-full p-4 border border-dashed border-gray-600 rounded-md flex flex-col items-center justify-center">
            <LockKeyhole className="h-8 w-8 mb-2 text-vegas-gold" />
            <p className="text-sm text-center text-gray-300 mb-4">{displayMessage}</p>
            {showUpgradeButton && renderUpgradeButton()}
          </div>
        );
        
      default:
        return null;
    }
  };
  
  // Renderizar botão de upgrade com opções de planos
  const renderUpgradeButton = () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="bg-vegas-gold hover:bg-vegas-gold/80 text-black">
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
  );
  
  return renderContent();
};

export default PremiumContent; 