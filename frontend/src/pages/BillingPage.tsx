import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CreditCard, Check, ExternalLink } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
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
    <div className="flex min-h-screen bg-[#22c55e0d]">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      
      <div className="flex-1 p-6 md:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto bg-[#1A191F] rounded-xl p-6 text-white shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Faturamento</h1>
            <Button 
              onClick={handleViewPlans} 
              className="bg-vegas-gold hover:bg-vegas-gold/80 text-black"
            >
              Ver todos os planos
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
          
          <Tabs defaultValue="subscription" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#111118] border border-[#33333359]">
              <TabsTrigger value="subscription" className="data-[state=active]:bg-vegas-gold data-[state=active]:text-black">
                Assinatura
              </TabsTrigger>
              <TabsTrigger value="payment-methods" className="data-[state=active]:bg-vegas-gold data-[state=active]:text-black">
                Métodos de Pagamento
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="subscription" className="mt-6">
              <ProfileSubscription />
            </TabsContent>
            
            {/* Histórico de Pagamentos */}
            <TabsContent value="payment-methods" className="mt-6">
              <div className="space-y-6">
                <div className="p-4 bg-[#111118] border border-[#33333359] rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Métodos de Pagamento</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 bg-vegas-black/60 border border-gray-700 rounded-lg">
                      <p className="mb-4">Esta plataforma utiliza o sistema de pagamento PIX através do Asaas.</p>
                      <div className="flex items-center p-3 border border-[#33333359] rounded-lg bg-[#1A191F]">
                        <div className="h-10 w-10 bg-[#111118] rounded-md mr-3 flex items-center justify-center">
                          <span className="text-green-500 font-bold">PIX</span>
                        </div>
                        <div>
                          <p className="font-medium">Pagamento via PIX</p>
                          <p className="text-xs text-gray-400">Processado por Asaas</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Histórico de Faturamento */}
                <div className="p-4 bg-[#111118] border border-[#33333359] rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Histórico de Faturamento</h3>
                  <div className="space-y-4">
                    {currentPlan ? (
                      <>
                        <div className="flex justify-between items-center text-sm pb-2 border-b border-[#33333359]">
                          <div className="flex items-center">
                            <CreditCard className="mr-2 text-green-500" size={16} />
                            <span>Abril 13, 2025</span>
                          </div>
                          <div>
                            <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded-full mr-2">Pago</span>
                            <span>R$ {currentPlan.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-2 border-b border-[#33333359]">
                          <div className="flex items-center">
                            <CreditCard className="mr-2 text-green-500" size={16} />
                            <span>Março 13, 2025</span>
                          </div>
                          <div>
                            <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded-full mr-2">Pago</span>
                            <span>R$ {currentPlan.price.toFixed(2)}</span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-2 border-b border-[#33333359]">
                          <div className="flex items-center">
                            <CreditCard className="mr-2 text-green-500" size={16} />
                            <span>Fevereiro 13, 2025</span>
                          </div>
                          <div>
                            <span className="bg-green-900/30 text-green-400 text-xs px-2 py-1 rounded-full mr-2">Pago</span>
                            <span>R$ {currentPlan.price.toFixed(2)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-400 text-center py-4">
                        Nenhum histórico de pagamento disponível.
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Notas de Faturamento */}
                <div className="p-4 bg-[#111118] border border-[#33333359] rounded-lg">
                  <h3 className="text-lg font-bold mb-4">Informações de Pagamento</h3>
                  
                  <div className="space-y-2 mb-4">
                    <p className="text-sm text-gray-300">• Os pagamentos são processados via PIX através da plataforma Asaas</p>
                    <p className="text-sm text-gray-300">• As cobranças são realizadas a cada período de acordo com seu plano</p>
                    <p className="text-sm text-gray-300">• Você pode cancelar sua assinatura a qualquer momento</p>
                    <p className="text-sm text-gray-300">• Em caso de dúvidas, entre em contato com o suporte</p>
                  </div>
                  
                  <Button 
                    onClick={handleViewPlans} 
                    className="mt-2 border border-vegas-gold text-vegas-gold hover:bg-vegas-gold/10"
                  >
                    Gerenciar Plano
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default BillingPage; 