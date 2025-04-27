import React, { ReactNode, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { LockKeyhole, Eye, EyeOff, Crown } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';

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
  /**
   * Se deve exigir plano premium, mesmo para outras verificações de recurso 
   */
  requirePremium?: boolean;
}

/**
 * Componente para proteger conteúdo premium
 * Exibe conteúdo alternativo ou bloqueado para usuários sem plano adequado
 */
const PremiumContent: React.FC<PremiumContentProps> = ({
  featureId,
  requiredPlan = PlanType.PREMIUM,
  children,
  fallbackContent,
  upgradeMessage,
  allowPeek = false,
  nonPremiumView = 'blur',
  blurIntensity = 5,
  showUpgradeButton = true,
  requirePremium = false
}) => {
  const { hasFeatureAccess, currentPlan } = useSubscription();
  const [isVisible, setIsVisible] = useState(false);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const navigate = useNavigate();

  // Verificar se o usuário tem acesso com base no featureId ou no plano requerido
  const hasAccess = requirePremium 
    ? currentPlan?.type === PlanType.PREMIUM
    : hasFeatureAccess(featureId);

  // Intensidade do blur em px
  const blurPx = blurIntensity * 2;

  // Se o usuário tem acesso, mostrar o conteúdo normalmente
  if (hasAccess) {
    return <>{children}</>;
  }

  // Função para ir para a página de planos
  const goToPlans = () => {
    setShowUpgradeDialog(false);
    navigate('/planos');
  };

  // Visibilidade temporária
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
    
    // Se está mostrando, configurar um timer para esconder depois de 10 segundos
    if (!isVisible) {
      setTimeout(() => setIsVisible(false), 10000);
    }
  };

  // Conteúdo para exibir quando não tem acesso
  const renderRestrictedContent = () => {
    // Se está permitindo visualização temporária e o usuário clicou para ver
    if (allowPeek && isVisible) {
      return (
        <div className="relative">
          {children}
          <div className="absolute bottom-2 right-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleVisibility}
              className="bg-black/60 text-white hover:bg-black/80"
            >
              <EyeOff className="h-4 w-4 mr-1" /> 
              Ocultar
            </Button>
          </div>
        </div>
      );
    }

    // Escolher o tipo de visualização com base na prop
    switch (nonPremiumView) {
      case 'blur':
        // Aplicar blur no conteúdo original
        return (
          <div className="relative">
            <div style={{ filter: `blur(${blurPx}px)` }} className="pointer-events-none">
              {children}
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 backdrop-blur-sm">
              <LockKeyhole className="h-8 w-8 text-yellow-400 mb-2" />
              <p className="text-center font-medium max-w-xs mb-4">
                {upgradeMessage || "Este recurso está disponível apenas para assinantes Premium"}
              </p>
              {showUpgradeButton && (
                <Button 
                  className="bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-700"
                  onClick={() => setShowUpgradeDialog(true)}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Fazer Upgrade
                </Button>
              )}
              {allowPeek && (
                <Button 
                  variant="link" 
                  onClick={toggleVisibility} 
                  className="mt-2 text-yellow-200"
                >
                  <Eye className="h-4 w-4 mr-1" /> 
                  Visualizar por 10 segundos
                </Button>
              )}
            </div>
          </div>
        );
      
      case 'placeholder':
        // Mostrar um placeholder genérico
        return (
          <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg bg-background/50">
            <LockKeyhole className="h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-center font-medium max-w-xs mb-4">
              {upgradeMessage || "Este recurso está disponível apenas para assinantes Premium"}
            </p>
            {showUpgradeButton && (
              <Button 
                className="bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-700"
                onClick={() => setShowUpgradeDialog(true)}
              >
                <Crown className="h-4 w-4 mr-2" />
                Fazer Upgrade
              </Button>
            )}
            {allowPeek && (
              <Button 
                variant="link" 
                onClick={toggleVisibility} 
                className="mt-2"
              >
                <Eye className="h-4 w-4 mr-1" /> 
                Visualizar por 10 segundos
              </Button>
            )}
          </div>
        );
      
      case 'fallback':
        // Mostrar conteúdo alternativo
        return fallbackContent ? (
          <div className="relative">
            {fallbackContent}
            {showUpgradeButton && (
              <div className="mt-2 flex justify-center">
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-700"
                  onClick={() => setShowUpgradeDialog(true)}
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Fazer Upgrade para ver completo
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Se não tiver fallback, usar o placeholder
          <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg bg-background/50">
            <LockKeyhole className="h-8 w-8 text-yellow-500 mb-2" />
            <p className="text-center font-medium max-w-xs mb-4">
              {upgradeMessage || "Este recurso está disponível apenas para assinantes Premium"}
            </p>
            {showUpgradeButton && (
              <Button 
                className="bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-700"
                onClick={() => setShowUpgradeDialog(true)}
              >
                <Crown className="h-4 w-4 mr-2" />
                Fazer Upgrade
              </Button>
            )}
          </div>
        );
      
      case 'hidden':
      default:
        // Esconder completamente
        return showUpgradeButton ? (
          <div className="flex flex-col items-center justify-center p-6 border border-dashed rounded-lg bg-background/50">
            <Button 
              className="bg-gradient-to-r from-yellow-400 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-700"
              onClick={() => setShowUpgradeDialog(true)}
            >
              <Crown className="h-4 w-4 mr-2" />
              Desbloquear recurso Premium
            </Button>
          </div>
        ) : null;
    }
  };

  return (
    <>
      {renderRestrictedContent()}
      
      {/* Diálogo de upgrade */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Crown className="h-5 w-5 text-yellow-500 mr-2" />
              Faça upgrade para o plano Premium
            </DialogTitle>
            <DialogDescription>
              Tenha acesso a todos os recursos exclusivos da plataforma, incluindo dados em tempo real, histórico completo e muito mais.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col space-y-4">
            <div className="bg-black/5 p-4 rounded-lg">
              <h4 className="font-semibold mb-2">Benefícios do plano Premium:</h4>
              <ul className="space-y-2">
                <li className="flex items-start">
                  <div className="rounded-full bg-green-500 p-1 mr-2 mt-0.5">
                    <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                  </div>
                  <span>Dados em tempo real de todas as roletas</span>
                </li>
                <li className="flex items-start">
                  <div className="rounded-full bg-green-500 p-1 mr-2 mt-0.5">
                    <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                  </div>
                  <span>Histórico completo de jogadas</span>
                </li>
                <li className="flex items-start">
                  <div className="rounded-full bg-green-500 p-1 mr-2 mt-0.5">
                    <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                  </div>
                  <span>Estatísticas avançadas e sugestões inteligentes</span>
                </li>
                <li className="flex items-start">
                  <div className="rounded-full bg-green-500 p-1 mr-2 mt-0.5">
                    <svg className="h-2 w-2 text-white" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                  </div>
                  <span>Suporte prioritário 24/7</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowUpgradeDialog(false)}
              >
                Mais tarde
              </Button>
              <Button 
                className="bg-gradient-to-r from-yellow-500 to-amber-600 text-black hover:from-yellow-600 hover:to-amber-700"
                onClick={goToPlans}
              >
                <Crown className="h-4 w-4 mr-2" />
                Ver planos disponíveis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PremiumContent; 