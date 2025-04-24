import { useAuth } from '@/context/AuthContext';
import { PlanType } from '@/types/plans';

// Estendendo a interface User do AuthContext para incluir planType
interface UserWithPlan {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  asaasCustomerId?: string;
  planType?: PlanType;
}

/**
 * Hook personalizado para acessar informações do usuário atual
 * Simplifica o acesso aos dados do usuário a partir do AuthContext
 */
export const useUser = () => {
  const auth = useAuth();
  
  // Converter o usuário para o tipo estendido
  const userWithPlan = auth.user as UserWithPlan | null;
  
  return {
    user: userWithPlan,
    isAuthenticated: !!userWithPlan,
    isAdmin: userWithPlan?.isAdmin || false,
    isLoading: auth.loading,
    
    // Funções de autenticação
    signIn: auth.signIn,
    signOut: auth.signOut,
    signUp: auth.signUp,
    
    // Verificar se o usuário tem um determinado plano
    hasPlan: (plan: PlanType): boolean => {
      if (!userWithPlan) return false;
      return (userWithPlan.planType || PlanType.FREE) >= plan;
    }
  };
};

export default useUser; 