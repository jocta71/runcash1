export interface PaymentStatus {
  status: 'PENDING' | 'CONFIRMED' | 'RECEIVED' | 'FAILED';
  data: {
    status: string;
    value: number;
    netValue: number;
    description: string;
    billingType: string;
    confirmedDate?: string;
    customer: string;
    subscription?: string;
  };
} 