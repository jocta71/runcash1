import { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { PaymentForm } from '@/components/PaymentForm';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { findAsaasPayment, getAsaasPixQrCode } from '@/integrations/asaas/client';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import CheckoutPage from '@/components/checkout/CheckoutPage';

const PaymentPage = () => {
  return <CheckoutPage />;
};

export default PaymentPage; 