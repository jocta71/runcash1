import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import ProfileSubscription from './ProfileSubscription';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';

const BillingPage = () => {
  const navigate = useNavigate();
  const { loading } = useSubscription();

  const handleViewPlans = () => {
    navigate('/planos');
  };

  return (
    <Layout>
      <div className="container py-6 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-white">Faturamento</h1>
          <Button 
            onClick={handleViewPlans} 
            className="bg-vegas-green hover:bg-vegas-green/90 text-black"
          >
            Ver todos os planos
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
        
        {/* Assinatura */}
        <ProfileSubscription />
        
        {/* Métodos de Pagamento */}
        <div className="p-4 border border-border rounded-lg bg-vegas-black">
          <h3 className="text-lg font-bold mb-4">Métodos de Pagamento</h3>
          
          <div className="flex items-center p-3 border border-border rounded-lg bg-vegas-black/40">
            <div className="h-10 w-10 bg-vegas-black rounded-md mr-3 flex items-center justify-center">
              <span className="text-vegas-green font-bold">PIX</span>
            </div>
            <div>
              <p className="font-medium">Pagamento via PIX</p>
              <p className="text-xs text-gray-400">Processado por Asaas</p>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-400">
            <p>Esta plataforma utiliza o sistema de pagamento PIX através do Asaas.</p>
          </div>
        </div>
        
        {/* Informações de Pagamento */}
        <div className="p-4 border border-border rounded-lg bg-vegas-black">
          <h3 className="text-lg font-bold mb-4">Informações de Pagamento</h3>
          
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-start">
              <div className="h-4 w-4 rounded-full bg-vegas-green/20 flex items-center justify-center mr-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-vegas-green"></div>
              </div>
              <span>Os pagamentos são processados via PIX através da plataforma Asaas</span>
            </li>
            <li className="flex items-start">
              <div className="h-4 w-4 rounded-full bg-vegas-green/20 flex items-center justify-center mr-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-vegas-green"></div>
              </div>
              <span>As cobranças são realizadas a cada período de acordo com seu plano</span>
            </li>
            <li className="flex items-start">
              <div className="h-4 w-4 rounded-full bg-vegas-green/20 flex items-center justify-center mr-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-vegas-green"></div>
              </div>
              <span>Você pode cancelar sua assinatura a qualquer momento</span>
            </li>
            <li className="flex items-start">
              <div className="h-4 w-4 rounded-full bg-vegas-green/20 flex items-center justify-center mr-2 mt-1">
                <div className="h-2 w-2 rounded-full bg-vegas-green"></div>
              </div>
              <span>Em caso de dúvidas, entre em contato com o suporte</span>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default BillingPage; 