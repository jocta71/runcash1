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
}

/**
 * Componente modificado que sempre permite acesso a todos recursos
 * independente do plano do usuário ou estado de autenticação.
 */
const PlanProtectedFeature: React.FC<PlanProtectedFeatureProps> = ({
  featureId,
  requiredPlan = PlanType.BASIC,
  children,
  lockedMessage,
  showUpgradeOption = true
}) => {
  // Retornar diretamente o conteúdo sem verificação de acesso
  return <>{children}</>;
};

export default PlanProtectedFeature; 