import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ExternalLink, CheckCircle, CreditCard, PlusCircle } from 'lucide-react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Switch } from '@/components/ui/switch';
import { useToast } from "@/components/ui/use-toast";

const BillingPage = () => {
  const navigate = useNavigate();
  const { currentSubscription, currentPlan } = useSubscription();
  const [autoRenew, setAutoRenew] = useState(true);
  const { toast } = useToast();

  // Dados simulados para demonstração
  const billingHistory = [
    { date: '08/07/2023', details: 'Plano Professional, mensal', amount: 'R$ 49,90', invoiceId: 'Fatura 08 Julho 23' },
    { date: '08/06/2023', details: 'Plano Professional, mensal', amount: 'R$ 49,90', invoiceId: 'Fatura 08 Junho 23' },
    { date: '08/05/2023', details: 'Plano Professional, mensal', amount: 'R$ 49,90', invoiceId: 'Fatura 08 Maio 23' },
  ];

  // Dados simulados para métodos de pagamento
  const paymentMethods = [
    { type: 'PIX', lastDigits: '', selected: true },
  ];

  const handleViewPlans = () => {
    navigate('/planos');
  };

  return (
    <Layout>
      <div className="container max-w-5xl mx-auto py-8 space-y-8">
        {/* Planos */}
        <div>
          <h2 className="text-xl font-bold mb-4">Plano</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Plano Básico */}
            <div className={`border rounded-lg p-4 ${currentPlan?.name === 'Básico' ? 'border-vegas-green' : 'border-border'}`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Básico</h3>
                <p className="font-bold">R$ 29,90<span className="text-sm font-normal text-gray-400">/mês</span></p>
              </div>
              <p className="text-gray-400 text-sm mb-4">30 dias restantes</p>
              {currentPlan?.name === 'Básico' ? (
                <Button 
                  variant="outline" 
                  className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                >
                  Cancelar Assinatura
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full border-border text-white hover:bg-vegas-black/60"
                >
                  Escolher
                </Button>
              )}
            </div>
            
            {/* Plano Professional */}
            <div className={`border rounded-lg p-4 relative bg-indigo-900/40 ${currentPlan?.name === 'Professional' ? 'border-vegas-green' : 'border-indigo-500/50'}`}>
              {currentPlan?.name === 'Professional' && (
                <div className="absolute -top-2 -left-2 bg-vegas-green rounded-full p-1">
                  <CheckCircle className="h-5 w-5 text-black" />
                </div>
              )}
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold">Professional</h3>
                <p className="font-bold">R$ 49,90<span className="text-sm font-normal text-gray-400">/mês</span></p>
              </div>
              <p className="text-gray-400 text-sm mb-4">365 dias</p>
              <div className="flex gap-2">
                {currentPlan?.name === 'Professional' ? (
                  <Button 
                    variant="outline" 
                    className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                  >
                    Cancelar Assinatura
                  </Button>
                ) : (
                  <Button 
                    className="bg-vegas-green text-black hover:bg-vegas-green/90 flex-1"
                  >
                    Upgrade
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  className="border-border text-white hover:bg-vegas-black/60"
                  onClick={handleViewPlans}
                >
                  Saiba mais
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Auto Renew Toggle */}
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">Renovação automática</h2>
              <p className="text-gray-400 text-sm mt-1">
                Esta opção, se marcada, renovará sua assinatura quando o plano atual expirar.
                Isso pode evitar que você perca acesso aos recursos premium.
              </p>
            </div>
            <Switch 
              checked={autoRenew} 
              onCheckedChange={setAutoRenew} 
              className="data-[state=checked]:bg-vegas-green" 
            />
          </div>
        </div>
        
        {/* Payment Method */}
        <div>
          <h2 className="text-xl font-bold mb-4">Método de Pagamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {paymentMethods.map((method, index) => (
              <div 
                key={index}
                className={`border rounded-lg p-4 relative ${method.selected ? 'border-vegas-green' : 'border-border'}`}
              >
                {method.selected && (
                  <div className="absolute -top-2 -right-2 bg-vegas-green rounded-full p-1">
                    <CheckCircle className="h-4 w-4 text-black" />
                  </div>
                )}
                <div className="flex items-center mb-2">
                  <div className="w-8 h-6 bg-vegas-black rounded-md mr-2 flex items-center justify-center">
                    <span className="text-vegas-green text-xs font-bold">PIX</span>
                  </div>
                  <p>PIX</p>
                </div>
                <p className="text-gray-400 text-sm">Processado por Asaas</p>
              </div>
            ))}
            
            {/* Add Payment Method */}
            <div 
              className="border border-dashed border-gray-600 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-vegas-green transition-colors"
              onClick={() => {
                toast({
                  title: "Funcionalidade em breve",
                  description: "A adição de novos métodos de pagamento estará disponível em breve."
                });
              }}
            >
              <div className="flex flex-col items-center text-gray-400">
                <PlusCircle className="h-6 w-6 mb-2" />
                <p className="text-sm">Adicionar método</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Billing History */}
        <div>
          <h2 className="text-xl font-bold mb-4">Histórico de Faturamento</h2>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-vegas-black/60 border-b border-border">
                <tr>
                  <th className="text-left p-4 font-medium">Data</th>
                  <th className="text-left p-4 font-medium">Detalhes</th>
                  <th className="text-left p-4 font-medium">Valor</th>
                  <th className="text-left p-4 font-medium">Download</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((item, index) => (
                  <tr key={index} className="border-b border-border last:border-0">
                    <td className="p-4">{item.date}</td>
                    <td className="p-4">{item.details}</td>
                    <td className="p-4">{item.amount}</td>
                    <td className="p-4">
                      <button className="text-vegas-green hover:underline">
                        {item.invoiceId}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default BillingPage; 