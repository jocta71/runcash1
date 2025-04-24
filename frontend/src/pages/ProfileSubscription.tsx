import { useState, useEffect } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, CreditCard, AlertTriangle, CheckCircle2, Clock, CalendarIcon, RefreshCw, ArrowRight, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { useAuth } from '@/context/AuthContext';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { CalendarDays, CalendarClock, Ban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Interface para pagamento
interface Payment {
  id: string;
  status: string;
  value: number;
  dueDate: string;
  paymentDate?: string;
  billingType: string;
  invoiceUrl?: string;
}

interface ProfileSubscriptionProps {
  isCompact?: boolean;
}

const ProfileSubscription = ({ isCompact = false }: ProfileSubscriptionProps) => {
  const { currentSubscription, currentPlan, loading, cancelSubscription, error, loadUserSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  
  // Obter histórico de pagamentos
  const fetchPaymentHistory = async () => {
    if (!user || !currentSubscription) return;
    
    setLoadingPayments(true);
    try {
      const response = await axios.get(`${API_URL}/api/asaas-find-subscription`, {
        params: { 
          subscriptionId: currentSubscription.id 
        }
      });
      
      if (response.data.success && response.data.payments) {
        setPayments(response.data.payments);
      }
    } catch (error) {
      console.error("Erro ao carregar histórico de pagamentos:", error);
    } finally {
      setLoadingPayments(false);
    }
  };
  
  // Carregar histórico de pagamentos quando a assinatura mudar
  useEffect(() => {
    if (currentSubscription) {
      fetchPaymentHistory();
    }
  }, [currentSubscription?.id]);
  
  // Atualizar dados da assinatura
  const refreshSubscriptionData = async (forceRefresh = false) => {
    setIsRefreshing(true);
    try {
      await loadUserSubscription();
      await fetchPaymentHistory();
      toast({
        title: "Dados atualizados",
        description: "Informações de assinatura atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar os dados. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  // Função para cancelar assinatura
  const handleCancelSubscription = async () => {
    try {
      setIsCanceling(true);
      await cancelSubscription();
      toast({
        title: "Assinatura cancelada",
        description: "Sua assinatura foi cancelada com sucesso. Você ainda terá acesso até o final do período pago.",
      });
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      toast({
        title: "Erro ao cancelar",
        description: "Ocorreu um erro ao cancelar sua assinatura. Por favor, tente novamente ou contate o suporte.",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
    }
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
  
  // Formatar valor monetário
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { 
      style: 'currency', 
      currency: 'BRL' 
    }).format(value);
  };
  
  // Obter ícone para o status da assinatura
  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'ativo':
      case 'confirmed':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'canceled':
      case 'cancelado':
        return <AlertTriangle className="h-6 w-6 text-red-500" />;
      case 'pending':
      case 'pendente':
        return <Clock className="h-6 w-6 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-6 w-6 text-gray-500" />;
    }
  };
  
  // Obter badge para o status da assinatura
  const getStatusBadge = (status: string) => {
    let variant: "default" | "destructive" | "outline" | "secondary" = "default";
    let label = status;
    
    switch (status?.toLowerCase()) {
      case 'active':
      case 'ativo':
      case 'confirmed':
        variant = "secondary";
        label = "Ativo";
        break;
      case 'canceled':
      case 'cancelado':
        variant = "destructive";
        label = "Cancelado";
        break;
      case 'pending':
      case 'pendente':
        variant = "outline";
        label = "Pendente";
        break;
      default:
        variant = "outline";
        label = status || "Desconhecido";
    }
    
    return <Badge variant={variant}>{label}</Badge>;
  };
  
  // Verificar status real da assinatura, considerando pagamentos pendentes
  const getEffectiveStatus = (): { status: string, badge: React.ReactNode, message?: string } => {
    // Se não temos informações sobre pagamentos, usar o status da assinatura
    if (!payments || payments.length === 0) {
      return { 
        status: currentSubscription.status,
        badge: getStatusBadge(currentSubscription.status)
      };
    }
    
    // Verificar se existem pagamentos pendentes (ignorar pagamentos já confirmados)
    const pendingPayments = payments.filter(p => 
      p.status.toLowerCase() === 'pending' || 
      p.status.toLowerCase() === 'pendente'
    );
    
    // Se há pagamentos pendentes, mostrar status como pendente independente do status da assinatura
    if (pendingPayments.length > 0) {
      return {
        status: 'pending',
        badge: <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/50">Pagamento Pendente</Badge>,
        message: "Sua assinatura será ativada após a confirmação do pagamento"
      };
    }
    
    // Caso contrário, retornar status normal
    return { 
      status: currentSubscription.status,
      badge: getStatusBadge(currentSubscription.status)
    };
  };
  
  // Obter badge para o status do pagamento
  const getPaymentStatusBadge = (status: string) => {
    let variant: "default" | "destructive" | "outline" | "secondary" = "default";
    let label = status;
    
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'received':
        variant = "secondary";
        label = "Confirmado";
        break;
      case 'overdue':
        variant = "destructive";
        label = "Vencido";
        break;
      case 'pending':
        variant = "outline";
        label = "Pendente";
        break;
      case 'refunded':
        variant = "secondary";
        label = "Reembolsado";
        break;
      case 'canceled':
        variant = "destructive";
        label = "Cancelado";
        break;
      default:
        variant = "outline";
        label = status || "Desconhecido";
    }
    
    return <Badge variant={variant}>{label}</Badge>;
  };
  
  // Obter label para método de pagamento
  const getPaymentMethodLabel = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'CREDIT_CARD':
        return 'Cartão de Crédito';
      case 'PIX':
        return 'PIX';
      case 'BOLETO':
        return 'Boleto';
      default:
        return method || 'Desconhecido';
    }
  };
  
  // Calcular progresso do ciclo atual (em termos de dias)
  const calculateCycleProgress = () => {
    if (!currentSubscription?.startDate || !currentSubscription?.nextBillingDate) {
      return 0;
    }
    
    const now = new Date();
    const start = new Date(currentSubscription.startDate);
    const end = new Date(currentSubscription.nextBillingDate);
    
    // Se já passou da data de renovação
    if (now > end) return 100;
    
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.min(Math.max(Math.floor((daysElapsed / totalDays) * 100), 0), 100);
  };
  
  // Tela de carregamento
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-vegas-black/30 rounded-lg border border-gray-700 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-vegas-gold mb-4" />
        <h2 className="text-xl font-semibold mb-2">Carregando dados da assinatura...</h2>
        <p className="text-center text-gray-400 mb-6 max-w-md">
          Estamos buscando as informações mais recentes da sua assinatura. Isso pode levar alguns instantes.
        </p>
      </div>
    );
  }
  
  // Tela de erro
  if (error) {
    return (
      <Card className="border-gray-700 bg-vegas-black/30">
        <CardHeader>
          <CardTitle>Erro ao carregar assinatura</CardTitle>
          <CardDescription>
            Não foi possível obter os dados da sua assinatura
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
          <p className="text-center text-gray-400 mb-6">
            {error}
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full"
            onClick={() => refreshSubscriptionData(true)}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...</>
            ) : (
              <><RefreshCw className="mr-2 h-4 w-4" /> Tentar novamente</>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Tela para usuário sem assinatura
  if (!currentSubscription) {
    return (
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
    );
  }
  
  // Tela principal de assinatura
  return (
    <div className="space-y-6">
      <Card className="border-gray-700 bg-vegas-black/30">
        <CardHeader className={`flex flex-row items-center justify-between ${isCompact ? 'p-3' : 'p-6'}`}>
          <div>
            <CardTitle className={isCompact ? 'text-lg' : 'text-xl'}>Sua Assinatura</CardTitle>
            <CardDescription className={isCompact ? 'text-xs' : 'text-sm'}>
              Detalhes da sua assinatura atual
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refreshSubscriptionData(true)}
            disabled={isRefreshing}
            className={isCompact ? "h-7 w-7" : "h-8 w-8"}
          >
            <RefreshCw className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        
        <CardContent className={isCompact ? "space-y-4 px-3 pb-3" : "space-y-6"}>
          {/* Cabeçalho com plano e status */}
          <div className="flex flex-col md:flex-row md:justify-between gap-4 items-start md:items-center">
            <div className="flex items-center space-x-3">
              <div className={`rounded-full bg-vegas-gold/10 ${isCompact ? 'p-2' : 'p-3'}`}>
                <CreditCard className={isCompact ? "h-4 w-4 text-vegas-gold" : "h-6 w-6 text-vegas-gold"} />
              </div>
              <div>
                <h3 className={isCompact ? "text-base font-bold" : "text-xl font-bold"}>{currentPlan?.name || 'Plano Desconhecido'}</h3>
                <p className={isCompact ? "text-xs text-gray-400" : "text-sm text-gray-400"}>{formatCurrency(currentPlan?.price || 0)}/mês</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon(getEffectiveStatus().status)}
              <div>
                <div className={isCompact ? "text-sm font-semibold" : "font-semibold"}>Status</div>
                <div className={isCompact ? "text-xs" : "text-sm"}>{getEffectiveStatus().badge}</div>
              </div>
            </div>
          </div>
          
          {/* Alerta de pagamento pendente */}
          {getEffectiveStatus().status === 'pending' && (
            <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-500">
                  Aguardando confirmação de pagamento
                </p>
                <p className="text-sm text-yellow-500/80 mt-1">
                  {getEffectiveStatus().message || "Sua assinatura será ativada assim que o pagamento for confirmado. Isso pode levar alguns minutos."}
                </p>
                {payments?.[0]?.invoiceUrl && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="mt-2 border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500"
                    onClick={() => window.open(payments[0].invoiceUrl, '_blank')}
                  >
                    <ArrowRight className="h-4 w-4 mr-1" />
                    {payments[0].billingType?.toUpperCase() === 'PIX' ? 'Realizar Pagamento' : 'Ver fatura'}
                  </Button>
                )}
              </div>
            </div>
          )}
          
          <Separator className="bg-gray-800" />
          
          {/* Progresso do ciclo */}
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm text-gray-400">Progresso do ciclo atual</span>
              <span className="text-sm font-medium">{calculateCycleProgress()}%</span>
            </div>
            <Progress value={calculateCycleProgress()} className="h-2" />
          </div>
          
          {/* Detalhes da assinatura */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="font-medium text-gray-400 mb-1">Data de início</h3>
              <p className="flex items-center">
                <CalendarIcon className="h-4 w-4 mr-2 text-vegas-gold" />
                {formatDate(currentSubscription.startDate)}
              </p>
            </div>
            
            {currentSubscription.nextBillingDate && (
              <div>
                <h3 className="font-medium text-gray-400 mb-1">Próxima cobrança</h3>
                <p className="flex items-center">
                  <CalendarIcon className="h-4 w-4 mr-2 text-vegas-gold" />
                  {formatDate(currentSubscription.nextBillingDate)}
                </p>
              </div>
            )}
            
            {currentSubscription.paymentMethod && (
              <div>
                <h3 className="font-medium text-gray-400 mb-1">Forma de pagamento</h3>
                <p className="flex items-center">
                  <CreditCard className="h-4 w-4 mr-2 text-vegas-gold" />
                  {getPaymentMethodLabel(currentSubscription.paymentMethod)}
                </p>
              </div>
            )}
          </div>
          
          {/* Recursos do plano */}
          <div>
            <h3 className="font-medium text-gray-400 mb-2">Recursos incluídos</h3>
            <ul className="space-y-2">
              {currentPlan?.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500 mt-0.5" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
        
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            variant="outline" 
            className="w-full sm:w-auto"
            onClick={() => navigate('/planos')}
          >
            Gerenciar plano
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="w-full sm:w-auto"
                disabled={isCanceling || currentSubscription.status?.toLowerCase() === 'canceled'}
              >
                {isCanceling ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelando...</>
                ) : (
                  "Cancelar assinatura"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao cancelar sua assinatura, você ainda terá acesso aos recursos premium até o final do período pago.
                  Após esse período, seu acesso será limitado às funcionalidades gratuitas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar</AlertDialogCancel>
                <AlertDialogAction onClick={handleCancelSubscription}>
                  Confirmar cancelamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
      
      {/* Histórico de pagamentos */}
      <Card className="border-gray-700 bg-vegas-black/30">
        <CardHeader>
          <CardTitle>Histórico de Pagamentos</CardTitle>
          <CardDescription>
            Seus pagamentos recentes
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {loadingPayments ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-vegas-gold" />
            </div>
          ) : payments.length > 0 ? (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-900/30 rounded-lg">
                  <div className="space-y-1 mb-2 sm:mb-0">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-medium">{formatCurrency(payment.value)}</h4>
                      {getPaymentStatusBadge(payment.status)}
                    </div>
                    <p className="text-sm text-gray-400">
                      Vencimento: {formatDate(payment.dueDate)}
                      {payment.paymentDate && ` • Pago em: ${formatDate(payment.paymentDate)}`}
                    </p>
                    <p className="text-sm text-gray-400">
                      Método: {getPaymentMethodLabel(payment.billingType)}
                    </p>
                  </div>
                  
                  {payment.invoiceUrl && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="mt-2 sm:mt-0"
                      onClick={() => window.open(payment.invoiceUrl, '_blank')}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      {payment.billingType?.toUpperCase() === 'PIX' ? 'Ver QR Code' : 'Ver fatura'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Clock className="h-12 w-12 mx-auto mb-3 text-gray-500" />
              <p>Nenhum pagamento encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileSubscription; 