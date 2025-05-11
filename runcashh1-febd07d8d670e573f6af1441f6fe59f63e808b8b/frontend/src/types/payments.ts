export type PaymentStatus = 
  | 'PAYMENT_RECEIVED' 
  | 'CONFIRMED'
  | 'RECEIVED'
  | 'PENDING'
  | 'WAITING_PAYMENT'
  | 'PROCESSING'
  | 'LOADING'
  | 'DECLINED'
  | 'REFUNDED'
  | 'CHARGEBACK'
  | 'ERROR';

export interface PaymentData {
  id: string;
  value: number;
  status: PaymentStatus;
  dueDate?: string;
  paymentDate?: string;
  planName?: string;
  planId?: string;
  invoiceUrl?: string;
  billingType?: string;
}
