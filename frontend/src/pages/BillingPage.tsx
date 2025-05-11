import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSubscription } from '@/context/SubscriptionContext';
import ProfileSubscription from './ProfileSubscription';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';

const BillingPage = () => {
  const navigate = useNavigate();
  const { currentPlan } = useSubscription();

  const handleViewPlans = () => {
    navigate('/planos');
  };

  return (
    <Layout>
      <div className="py-6">
        <div className="border border-[#222] rounded-lg bg-vegas-black overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-[#222]">
            <h1 className="text-xl font-bold text-white">Assinatura</h1>
            <Button 
              onClick={handleViewPlans} 
              className="bg-gradient-to-b from-[#00FF00] to-[#A3FFA3] hover:from-[#00FF00]/90 hover:to-[#A3FFA3]/90 text-black"
              size="sm"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Ver planos
            </Button>
          </div>
          
          <Tabs defaultValue="subscription" className="w-full">
            <TabsList className="w-full border-b border-[#222] bg-transparent p-0 h-auto">
              <TabsTrigger 
                value="subscription" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#00FF00] data-[state=active]:bg-transparent data-[state=active]:text-[#00FF00] hover:bg-vegas-black/50 py-3"
              >
                Assinatura
              </TabsTrigger>
              <TabsTrigger 
                value="payment-methods" 
                className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-[#00FF00] data-[state=active]:bg-transparent data-[state=active]:text-[#00FF00] hover:bg-vegas-black/50 py-3"
              >
                Pagamentos
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="subscription" className="p-0 mt-0">
              <ProfileSubscription />
            </TabsContent>
            
            <TabsContent value="payment-methods" className="p-4">
              <div className="space-y-4">
                <div className="p-4 border border-[#222] rounded-lg bg-vegas-black/50">
                  <h3 className="text-base font-medium text-white mb-3">Forma de pagamento</h3>
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-md bg-[#143814] flex items-center justify-center text-xs font-bold text-[#00FF00]">PIX</div>
                    <div className="flex-1">
                      <p className="text-sm text-white">Pagamento via PIX</p>
                      <p className="text-xs text-gray-400">Processado por Asaas</p>
                    </div>
                  </div>
                </div>
                
                {currentPlan && (
                  <div className="p-4 border border-[#222] rounded-lg bg-vegas-black/50">
                    <h3 className="text-base font-medium text-white mb-3">Informações importantes</h3>
                    <ul className="space-y-1.5 text-sm text-gray-300">
                      <li className="flex items-start">
                        <span className="text-[#00FF00] mr-2">•</span>
                        <span>Processamento via PIX (pagamento instantâneo)</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-[#00FF00] mr-2">•</span>
                        <span>Cobrança mensal de R$ {currentPlan.price?.toFixed(2)}</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-[#00FF00] mr-2">•</span>
                        <span>Cancelamento disponível a qualquer momento</span>
                      </li>
                      <li className="flex items-start">
                        <span className="text-[#00FF00] mr-2">•</span>
                        <span>Suporte prioritário para assinantes</span>
                      </li>
                    </ul>
                  </div>
                )}
                
                <Button 
                  onClick={handleViewPlans} 
                  variant="outline"
                  className="w-full border-[#00FF00]/30 text-[#00FF00] hover:bg-[#143814] hover:text-[#00FF00] mt-2"
                >
                  Gerenciar Plano
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default BillingPage; 