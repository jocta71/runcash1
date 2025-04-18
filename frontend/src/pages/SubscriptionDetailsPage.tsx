import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import { findAsaasSubscription, cancelAsaasSubscription } from '@/integrations/asaas/client';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, CreditCard, AlertTriangle, CheckCircle2, Clock, ArrowLeft, Download, ExternalLink } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

// Tipo para o histórico de pagamentos
interface PaymentHistory {
  id: string;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
  dueDate: string;
  paymentDate?: string;
  invoiceUrl?: string;
  description: string;
}

const SubscriptionDetailsPage = () => {
  const { currentSubscription, currentPlan, loading } = useSubscription();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isCanceling, setIsCanceling] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  
  // Carregar detalhes da assinatura e histórico de pagamentos
  useEffect(() => {
    const loadSubscriptionDetails = async () => {
      if (!currentSubscription?.id) return;
      
      try {
        setIsLoadingDetails(true);
        // Buscar detalhes da assinatura usando o ID armazenado
        const response = await findAsaasSubscription(currentSubscription.paymentId || '');
        setSubscriptionDetails(response.subscription);
        
        // Ordenar pagamentos por data de vencimento (mais recente primeiro)
        if (response.payments && Array.isArray(response.payments)) {
          const sortedPayments = [...response.payments].sort((a, b) => 
            new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()
          );
          setPaymentHistory(sortedPayments);
        }
      } catch (error) {
        console.error('Erro ao carregar detalhes da assinatura:', error);
        toast({
          variant: "destructive",
          title: "Erro ao carregar detalhes",
          description: "Não foi possível obter os detalhes da sua assinatura. Tente novamente mais tarde.",
        });
      } finally {
        setIsLoadingDetails(false);
      }
    };
    
    loadSubscriptionDetails();
  }, [currentSubscription]);
  
  const handleCancelSubscription = async () => {
    if (!currentSubscription?.paymentId) {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "ID da assinatura não encontrado",
      });
      return;
    }
    
    try {
      setIsCanceling(true);
      await cancelAsaasSubscription(currentSubscription.paymentId);
      
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura foi cancelada com sucesso. Você ainda terá acesso até o final do período pago.",
      });
      
      // Recarregar a página após um breve atraso
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: "Ocorreu um erro ao cancelar sua assinatura. Por favor, tente novamente ou contate o suporte.",
      });
    } finally {
      setIsCanceling(false);
    }
  };
  
  // Formatar valor para exibição
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  // Formatar data para exibição
  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };
  
  // Obter badge para status do pagamento
  const getPaymentStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'RECEIVED':
        return <Badge className="bg-green-500 hover:bg-green-600">Pago</Badge>;
      case 'PENDING':
      case 'AWAITING':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600">Pendente</Badge>;
      case 'OVERDUE':
        return <Badge className="bg-red-500 hover:bg-red-600">Atrasado</Badge>;
      case 'REFUNDED':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Reembolsado</Badge>;
      case 'CANCELED':
        return <Badge className="bg-gray-500 hover:bg-gray-600">Cancelado</Badge>;
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600">{status}</Badge>;
    }
  };
  
  // Obter ícone para status da assinatura
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle2 className="h-10 w-10 text-green-500" />;
      case 'trial':
        return <Clock className="h-10 w-10 text-blue-500" />;
      case 'canceled':
        return <AlertTriangle className="h-10 w-10 text-gray-500" />;
      case 'overdue':
        return <AlertTriangle className="h-10 w-10 text-red-500" />;
      default:
        return <CreditCard className="h-10 w-10 text-gray-400" />;
    }
  };
  
  // Loading state
  if (loading || isLoadingDetails) {
    return (
      <div className="flex min-h-screen bg-[#22c55e0d]">
        <div className="w-64 flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-vegas-gold mx-auto mb-4" />
            <p className="text-gray-400">Carregando detalhes da assinatura...</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Verificar se existe assinatura
  if (!currentSubscription || !currentPlan) {
    return (
      <div className="flex min-h-screen bg-[#22c55e0d]">
        <div className="w-64 flex-shrink-0">
          <Sidebar />
        </div>
        <div className="flex-1 p-6 md:p-10">
          <div className="max-w-4xl mx-auto bg-[#1A191F] rounded-xl p-6 text-white shadow-lg">
            <Button 
              variant="ghost" 
              className="mb-6" 
              onClick={() => navigate('/billing')}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para faturamento
            </Button>
            
            <Card className="border-gray-700 bg-vegas-black/30">
              <CardHeader>
                <CardTitle>Nenhuma assinatura ativa</CardTitle>
                <CardDescription>
                  Você não possui nenhuma assinatura ativa no momento
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CreditCard className="h-16 w-16 text-gray-500 mb-4" />
                <p className="text-center text-gray-400 mb-6">
                  Assine um de nossos planos para ter acesso a recursos premium da plataforma.
                </p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                  onClick={() => navigate('/planos')}
                >
                  Ver planos disponíveis
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-[#22c55e0d]">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      
      <div className="flex-1 p-6 md:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto bg-[#1A191F] rounded-xl p-6 text-white shadow-lg">
          <Button 
            variant="ghost" 
            className="mb-6" 
            onClick={() => navigate('/billing')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para faturamento
          </Button>
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Detalhes da Assinatura</h1>
            {currentSubscription.status === 'active' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="destructive" 
                    className="bg-red-600 hover:bg-red-700"
                    disabled={isCanceling}
                  >
                    {isCanceling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      "Cancelar assinatura"
                    )}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-vegas-black border-gray-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ao cancelar sua assinatura, você perderá acesso a todos os recursos premium 
                      quando o período atual terminar. Essa ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-gray-700 bg-transparent">Voltar</AlertDialogCancel>
                    <AlertDialogAction 
                      className="bg-red-600 hover:bg-red-700"
                      onClick={handleCancelSubscription}
                    >
                      Confirmar cancelamento
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-[#111118] border border-[#33333359]">
              <TabsTrigger value="details" className="data-[state=active]:bg-vegas-gold data-[state=active]:text-black">
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="history" className="data-[state=active]:bg-vegas-gold data-[state=active]:text-black">
                Histórico de Pagamentos
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="mt-6">
              <Card className="border-gray-700 bg-vegas-black/30">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>{currentPlan.name}</CardTitle>
                    <CardDescription>
                      {formatCurrency(currentPlan.price)} / {currentPlan.interval === 'monthly' ? 'mês' : 'ano'}
                    </CardDescription>
                  </div>
                  {getStatusIcon(currentSubscription.status)}
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm text-gray-400 mb-1">Status</h3>
                      <p className="font-medium">
                        {currentSubscription.status === 'active' ? 'Ativa' : 
                         currentSubscription.status === 'canceled' ? 'Cancelada' : 
                         currentSubscription.status === 'trial' ? 'Em período de teste' : 
                         currentSubscription.status === 'past_due' ? 'Pagamento atrasado' : 
                         currentSubscription.status}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm text-gray-400 mb-1">ID da assinatura</h3>
                      <p className="font-medium text-xs">{currentSubscription.paymentId || currentSubscription.id}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-sm text-gray-400 mb-1">Data de início</h3>
                      <p className="font-medium">{formatDate(currentSubscription.startDate)}</p>
                    </div>
                    
                    {currentSubscription.nextBillingDate && (
                      <div>
                        <h3 className="text-sm text-gray-400 mb-1">Próxima cobrança</h3>
                        <p className="font-medium">{formatDate(currentSubscription.nextBillingDate)}</p>
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <h3 className="text-sm text-gray-400 mb-1">Método de pagamento</h3>
                    <p className="font-medium flex items-center">
                      <CreditCard className="h-4 w-4 mr-2" />
                      {currentSubscription.paymentMethod || 'PIX'}
                    </p>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-700">
                    <h3 className="font-medium mb-3">Recursos incluídos:</h3>
                    <ul className="space-y-2">
                      {currentPlan.features.map((feature, index) => (
                        <li key={index} className="text-sm text-gray-300 flex items-start">
                          <CheckCircle2 className="h-4 w-4 text-vegas-gold mr-2 flex-shrink-0 mt-0.5" /> 
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="history" className="mt-6">
              <Card className="border-gray-700 bg-vegas-black/30">
                <CardHeader>
                  <CardTitle>Histórico de Pagamentos</CardTitle>
                  <CardDescription>
                    Veja o histórico completo de pagamentos da sua assinatura
                  </CardDescription>
                </CardHeader>
                
                <CardContent>
                  {paymentHistory.length > 0 ? (
                    <div className="space-y-4">
                      {paymentHistory.map((payment) => (
                        <div 
                          key={payment.id} 
                          className="p-4 border border-gray-700 rounded-lg bg-vegas-black/40 flex flex-col sm:flex-row justify-between"
                        >
                          <div className="space-y-2 mb-3 sm:mb-0">
                            <div className="flex items-center">
                              <p className="font-medium">{payment.description || 'Pagamento de assinatura'}</p>
                              <span className="mx-2">•</span>
                              {getPaymentStatusBadge(payment.status)}
                            </div>
                            
                            <div className="flex flex-col text-sm text-gray-400">
                              <div className="flex items-center">
                                <span className="mr-2">Vencimento:</span>
                                {formatDate(payment.dueDate)}
                              </div>
                              
                              {payment.paymentDate && (
                                <div className="flex items-center">
                                  <span className="mr-2">Pagamento:</span>
                                  {formatDate(payment.paymentDate)}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end">
                            <p className="font-bold text-lg">
                              {formatCurrency(payment.value)}
                            </p>
                            
                            <div className="flex mt-2">
                              {payment.invoiceUrl && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="text-xs h-8 px-2 border-gray-700"
                                  onClick={() => window.open(payment.invoiceUrl, '_blank')}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Comprovante
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Clock className="h-12 w-12 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400">Nenhum histórico de pagamento disponível.</p>
                      {subscriptionDetails?.status === 'active' && (
                        <p className="text-gray-400 mt-2">Os pagamentos serão exibidos aqui após o processamento.</p>
                      )}
                    </div>
                  )}
                </CardContent>
                
                <CardFooter className="flex flex-col text-sm text-gray-400 space-y-2 border-t border-gray-700 pt-4">
                  <p>• Os pagamentos são processados via PIX através da plataforma Asaas</p>
                  <p>• Caso tenha problemas com pagamentos, entre em contato com o suporte</p>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionDetailsPage; 