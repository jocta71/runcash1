export interface PlanType {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'monthly' | 'annual';
  features: string[];
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