import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import Layout from '@/components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowRight, Calendar, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/utils/date';

interface BillingPageProps {
  currentSideContent?: string | null;
  setCurrentSideContent?: React.Dispatch<React.SetStateAction<string | null>>;
}

const BillingPage = ({ currentSideContent, setCurrentSideContent }: BillingPageProps) => {
  const { user } = useAuth();
  const { currentPlan, paymentHistory, loading, loadPaymentHistory } = useSubscription();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('subscription');
  
  useEffect(() => {
    // Carregar histórico de pagamentos quando o componente montar
    if (loadPaymentHistory) {
      loadPaymentHistory();
    }
  }, [loadPaymentHistory]);

  const handlePlanClick = () => {
    // Se temos a função para setar o conteúdo lateral e estamos na página principal
    if (setCurrentSideContent && window.location.pathname === '/') {
      setCurrentSideContent('plans');
    } else {
      navigate('/planos');
    }
  };

  return (
    <Layout setCurrentSideContent={setCurrentSideContent}>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <h1 className="text-3xl font-bold mb-6">Minha Conta</h1>
        
        <Tabs 
          defaultValue="subscription" 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="grid grid-cols-2 mb-8">
            <TabsTrigger value="subscription">Assinatura</TabsTrigger>
            <TabsTrigger value="payments">Histórico de Pagamentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="subscription" className="space-y-8">
            <div className="bg-vegas-black/60 rounded-lg p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">Plano Atual</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-vegas-gold" />
                </div>
              ) : currentPlan ? (
                <div className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-gray-800 pb-4">
                    <div>
                      <span className="text-vegas-gold font-medium text-lg mb-1">
                        {currentPlan.name}
                      </span>
                      <p className="text-sm text-gray-400">{currentPlan.description}</p>
                    </div>
                    <div className="mt-2 md:mt-0">
                      <span className="text-2xl font-bold">
                        R$ {currentPlan.price.toFixed(2)}
                      </span>
                      <span className="text-gray-400 text-sm">
                        /{currentPlan.interval === 'monthly' ? 'mês' : 'ano'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm">Próxima cobrança</span>
                      </div>
                      <span className="font-medium">
                        {currentPlan.expirationDate 
                          ? formatDate(new Date(currentPlan.expirationDate))
                          : 'Não disponível'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Clock className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm">Status</span>
                      </div>
                      <span className="bg-green-500/20 text-green-500 text-xs px-2 py-1 rounded-full">
                        Ativo
                      </span>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={handlePlanClick}
                    >
                      Ver Outros Planos <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-gray-800/50 rounded-lg p-4">
                    <p className="text-gray-400 text-center">
                      Você não possui nenhum plano ativo no momento.
                    </p>
                  </div>
                  
                  <Button 
                    variant="default" 
                    className="w-full bg-vegas-gold hover:bg-vegas-gold/80 text-black font-medium"
                    onClick={handlePlanClick}
                  >
                    Ver Planos Disponíveis <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="payments" className="space-y-8">
            <div className="bg-vegas-black/60 rounded-lg p-6 border border-gray-800">
              <h2 className="text-xl font-bold mb-4">Histórico de Pagamentos</h2>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-vegas-gold" />
                </div>
              ) : paymentHistory && paymentHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-4">Data</th>
                        <th className="text-left py-3 px-4">Descrição</th>
                        <th className="text-left py-3 px-4">Valor</th>
                        <th className="text-left py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentHistory.map((payment, index) => (
                        <tr key={index} className="border-b border-gray-800">
                          <td className="py-3 px-4">
                            {payment.date ? formatDate(new Date(payment.date)) : 'N/A'}
                          </td>
                          <td className="py-3 px-4">{payment.description || 'Pagamento'}</td>
                          <td className="py-3 px-4">R$ {payment.amount?.toFixed(2) || '0.00'}</td>
                          <td className="py-3 px-4">
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' || payment.status === 'AVAILABLE'
                                ? 'bg-green-500/20 text-green-500'
                                : payment.status === 'PENDING'
                                ? 'bg-yellow-500/20 text-yellow-500'
                                : 'bg-red-500/20 text-red-500'
                            }`}>
                              {payment.status === 'CONFIRMED' || payment.status === 'RECEIVED' || payment.status === 'AVAILABLE'
                                ? 'Pago'
                                : payment.status === 'PENDING'
                                ? 'Pendente'
                                : 'Cancelado'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-400">
                    Nenhum pagamento encontrado no histórico.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default BillingPage; 