export enum PlanType {
  FREE = 'free',
  BASIC = 'basic',
  PRO = 'pro',
  PREMIUM = 'premium'
}

export interface Plan {
  id: string;
  name: string;
  type: PlanType;
  description: string;
  price: number;
  interval: 'monthly' | 'annual';
  features: string[];
  allowedFeatures: string[];
}

export interface UserSubscription {
  id: string;
  subscriptionId?: string;
  userId?: string;
  planId: string;
  planType?: PlanType;
  status: 'active' | 'inactive' | 'overdue' | 'canceled' | 'pending';
  startDate: string;
  endDate: string | null;
  nextDueDate?: string;
  autoRenew?: boolean;
  paymentMethod?: string;
  paymentProvider?: string;
}

export interface PlanFeature {
  id: string;
  name: string;
  description: string;
  includedInPlans: PlanType[];
} 