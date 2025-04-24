import { Button } from '@/components/ui/button';
import { CreditCard, ExternalLink } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSubscription } from '@/context/SubscriptionContext';
import ProfileSubscription from './ProfileSubscription';
import { useNavigate } from 'react-router-dom';

const BillingPage = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { currentPlan, loading } = useSubscription();

  const handleViewPlans = () => {
    navigate('/planos');
  };

  return (
    <div className="py-4 px-2">
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-white">Faturamento</h1>
          <Button 
            onClick={handleViewPlans} 
            className="bg-vegas-gold hover:bg-vegas-gold/80 text-black text-xs h-8"
          >
            Ver planos
            <ExternalLink className="ml-2 h-3 w-3" />
          </Button>
        </div>
        
        <Tabs defaultValue="subscription" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#111118] border border-[#33333359]">
            <TabsTrigger value="subscription" className="data-[state=active]:bg-vegas-gold data-[state=active]:text-black text-xs py-1">
              Assinatura
            </TabsTrigger>
            <TabsTrigger value="payment-methods" className="data-[state=active]:bg-vegas-gold data-[state=active]:text-black text-xs py-1">
              Pagamentos
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="subscription" className="mt-4">
            <ProfileSubscription isCompact={true} />
          </TabsContent>
          
          {/* Histórico de Pagamentos */}
          <TabsContent value="payment-methods" className="mt-4">
            <div className="space-y-4">
              <div className="p-3 bg-[#111118] border border-[#33333359] rounded-lg">
                <h3 className="text-sm font-bold mb-3">Métodos de Pagamento</h3>
                
                <div className="space-y-3">
                  <div className="p-3 bg-vegas-black/60 border border-gray-700 rounded-lg">
                    <p className="mb-3 text-xs">Esta plataforma utiliza o sistema de pagamento PIX através do Asaas.</p>
                    <div className="flex items-center p-2 border border-[#33333359] rounded-lg bg-[#1A191F]">
                      <div className="h-8 w-8 bg-[#111118] rounded-md mr-2 flex items-center justify-center">
                        <span className="text-green-500 font-bold text-xs">PIX</span>
                      </div>
                      <div>
                        <p className="font-medium text-xs">Pagamento via PIX</p>
                        <p className="text-xs text-gray-400">Processado por Asaas</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Histórico de Faturamento */}
              <div className="p-3 bg-[#111118] border border-[#33333359] rounded-lg">
                <h3 className="text-sm font-bold mb-3">Histórico de Faturamento</h3>
                <div className="space-y-3">
                  {currentPlan ? (
                    <>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-[#33333359]">
                        <div className="flex items-center">
                          <CreditCard className="mr-2 text-green-500" size={14} />
                          <span>Abril 13, 2025</span>
                        </div>
                        <div>
                          <span className="bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full mr-2">Pago</span>
                          <span>R$ {currentPlan.price.toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-[#33333359]">
                        <div className="flex items-center">
                          <CreditCard className="mr-2 text-green-500" size={14} />
                          <span>Março 13, 2025</span>
                        </div>
                        <div>
                          <span className="bg-green-900/30 text-green-400 text-xs px-2 py-0.5 rounded-full mr-2">Pago</span>
                          <span>R$ {currentPlan.price.toFixed(2)}</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-gray-400 text-center py-3 text-xs">
                      Nenhum histórico de pagamento disponível.
                    </p>
                  )}
                </div>
              </div>
              
              {/* Notas de Faturamento */}
              <div className="p-3 bg-[#111118] border border-[#33333359] rounded-lg">
                <h3 className="text-sm font-bold mb-3">Informações de Pagamento</h3>
                
                <div className="space-y-1 mb-3">
                  <p className="text-xs text-gray-300">• Os pagamentos são processados via PIX através da plataforma Asaas</p>
                  <p className="text-xs text-gray-300">• As cobranças são realizadas a cada período de acordo com seu plano</p>
                  <p className="text-xs text-gray-300">• Você pode cancelar sua assinatura a qualquer momento</p>
                </div>
                
                <Button 
                  onClick={handleViewPlans} 
                  className="mt-2 border border-vegas-gold text-vegas-gold hover:bg-vegas-gold/10 text-xs h-7 w-full"
                >
                  Gerenciar Plano
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BillingPage; 