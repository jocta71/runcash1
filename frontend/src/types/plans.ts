export enum PlanType {
  FREE = 'FREE',
  BASIC = 'BASIC',
  PRO = 'PRO',
  PREMIUM = 'PREMIUM'
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
  userId?: string;
  customerId?: string;
  planId: string;
  planType?: PlanType;
  startDate?: Date;
  createdAt?: string;
  endDate?: Date | null;
  status: string;
  paymentMethod?: string;
  paymentProvider?: 'stripe' | 'manual' | 'ASAAS';
  paymentId?: string;
  nextBillingDate?: Date | null;
  nextDueDate?: string;
  lastPaymentDate?: string | null;
  value?: number;
} 