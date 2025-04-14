/**
 * Tipos relacionados aos planos de assinatura
 */

/**
 * Tipos de planos disponíveis
 */
export type PlanType = 'basic' | 'pro';

/**
 * Interface para plano de assinatura
 */
export interface Plan {
  id: PlanType;
  name: string;
  description: string;
  price: number;
  billingPeriod: 'monthly' | 'annual';
  features: string[];
  isPopular?: boolean;
  asaasId?: string; // ID do plano no Asaas
}

/**
 * Interface para resposta de planos da API
 */
export interface PlansResponse {
  success: boolean;
  plans?: Plan[];
  error?: string;
}

/**
 * Interface para resposta de assinaturas da API
 */
export interface SubscriptionResponse {
  success: boolean;
  subscription?: {
    id: string;
    planId: PlanType;
    status: 'active' | 'canceled' | 'pending' | 'overdue';
    startDate: string;
    nextBillingDate?: string;
    canceledAt?: string;
  };
  error?: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'pending' | 'expired';
  provider: string;
  externalId?: string;
  startDate: Date;
  endDate?: Date | null;
  autoRenew: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
} 