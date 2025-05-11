import { useState, useEffect } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, CreditCard, AlertTriangle, CheckCircle2, CalendarIcon, RefreshCw, ArrowRight } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '@/config/constants';
import { useAuth } from '@/context/AuthContext';
import { Progress } from '@/components/ui/progress';

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

const ProfileSubscription = () => {
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
        params: { subscriptionId: currentSubscription.id }
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
  const refreshSubscriptionData = async () => {
    setIsRefreshing(true);
    try {
      await loadUserSubscription();
      await fetchPaymentHistory();
      toast({
        title: "Dados atualizados",
        description: "Informações atualizadas com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      toast({
        title: "Erro ao atualizar",
        description: "Tente novamente mais tarde.",
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
        description: "Você terá acesso até o final do período pago.",
      });
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error);
      toast({
        title: "Erro ao cancelar",
        description: "Tente novamente ou contate o suporte.",
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
  
  // Calcular progresso do ciclo atual (em termos de dias)
  const calculateCycleProgress = () => {
    if (!currentSubscription?.startDate || !currentSubscription?.nextBillingDate) {
      return 0;
    }
    
    const now = new Date();
    const start = new Date(currentSubscription.startDate);
    const end = new Date(currentSubscription.nextBillingDate);
    
    if (now > end) return 100;
    
    const totalDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    return Math.min(Math.max(Math.floor((daysElapsed / totalDays) * 100), 0), 100);
  };

  // Estados de carregamento e erro
  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00FF00] mb-2" />
        <p className="text-sm text-gray-400">Carregando informações...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-[#222] rounded-lg bg-vegas-black/50 text-center">
        <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
        <h3 className="text-base font-medium mb-2">Erro ao carregar dados</h3>
        <p className="text-sm text-gray-400 mb-4">{error}</p>
        <Button 
          onClick={() => refreshSubscriptionData()}
          disabled={isRefreshing}
          variant="outline"
          size="sm"
          className="mx-auto"
        >
          {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!currentSubscription) {
    return (
      <div className="p-6 border border-[#222] rounded-lg bg-vegas-black/50 text-center">
        <CreditCard className="h-8 w-8 text-gray-500 mx-auto mb-2" />
        <h3 className="text-base font-medium mb-2">Nenhuma assinatura ativa</h3>
        <p className="text-sm text-gray-400 mb-4">Assine um plano para acessar recursos premium.</p>
        <Button 
          onClick={() => navigate('/planos')}
          className="bg-gradient-to-b from-[#00FF00] to-[#A3FFA3] hover:from-[#00FF00]/90 hover:to-[#A3FFA3]/90 text-black"
          size="sm"
        >
          Ver planos disponíveis
        </Button>
      </div>
    );
  }

  // Verificar se há pagamento pendente
  const pendingPayment = payments.find(p => 
    p.status.toLowerCase() === 'pending' || 
    p.status.toLowerCase() === 'pendente'
  );

  // Verificar status da assinatura
  const isActive = currentSubscription.status?.toLowerCase() === 'active' || 
                 currentSubscription.status?.toLowerCase() === 'ativo';
  
  const isCanceled = currentSubscription.status?.toLowerCase() === 'canceled' || 
                   currentSubscription.status?.toLowerCase() === 'cancelado';
  
  return (
    <div className="divide-y divide-[#222]">
      {/* Cabeçalho com status e refresh */}
      <div className="p-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-[#00FF00]' : isCanceled ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <span className="text-sm font-medium">
            {isActive ? 'Ativo' : isCanceled ? 'Cancelado' : 'Pendente'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refreshSubscriptionData()}
          disabled={isRefreshing}
          className="h-8 w-8 p-0"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#00FF00]' : 'text-gray-400'}`} />
        </Button>
      </div>

      {/* Alerta de pagamento pendente */}
      {pendingPayment && (
        <div className="p-4 bg-[#332b00] border-y border-[#554700]">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-500">Aguardando confirmação de pagamento</p>
              <p className="text-xs text-yellow-400/80 mt-0.5 mb-2">
                Sua assinatura será ativada após a confirmação do pagamento.
              </p>
              {pendingPayment.invoiceUrl && (
                <Button 
                  variant="outline" 
                  size="sm"
                  className="mt-1 border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-500"
                  onClick={() => window.open(pendingPayment.invoiceUrl, '_blank')}
                >
                  <ArrowRight className="h-4 w-4 mr-1" />
                  Pagar agora
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Detalhes do plano */}
      <div className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-lg font-medium">{currentPlan?.name || 'Plano'}</h3>
            <p className="text-sm text-gray-400 mt-1">
              {`R$ ${currentPlan?.price?.toFixed(2) || '0,00'}/mês`}
            </p>
          </div>
          <div className="flex items-center">
            <CreditCard className="text-[#00FF00] mr-2 h-5 w-5" />
            <span className="text-sm">PIX</span>
          </div>
        </div>
        
        {/* Progresso do ciclo */}
        {isActive && (
          <div className="mt-4">
            <div className="flex justify-between mb-1.5 items-center">
              <span className="text-xs text-gray-400">Ciclo atual</span>
              <span className="text-xs font-medium">{calculateCycleProgress()}%</span>
            </div>
            <Progress value={calculateCycleProgress()} className="h-1.5 bg-[#222]" indicatorClassName="bg-[#00FF00]" />
            <div className="flex justify-between mt-1.5">
              <div className="flex items-center">
                <CalendarIcon className="h-3 w-3 mr-1 text-gray-400" />
                <span className="text-xs text-gray-400">{formatDate(currentSubscription.startDate)}</span>
              </div>
              <div className="flex items-center">
                <CalendarIcon className="h-3 w-3 mr-1 text-gray-400" />
                <span className="text-xs text-gray-400">{formatDate(currentSubscription.nextBillingDate)}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Lista de recursos */}
        <div className="mt-5 space-y-1.5">
          {currentPlan?.features?.slice(0, 4).map((feature, index) => (
            <div key={index} className="flex items-start">
              <CheckCircle2 className="h-4 w-4 mr-1.5 text-[#00FF00] flex-shrink-0 mt-0.5" />
              <span className="text-sm">{feature}</span>
            </div>
          ))}
          {currentPlan?.features?.length > 4 && (
            <div className="flex items-center">
              <span className="text-xs text-gray-400 ml-5.5">+{currentPlan.features.length - 4} recursos incluídos</span>
            </div>
          )}
        </div>
      </div>

      {/* Botões de ação */}
      <div className="p-4 flex flex-col sm:flex-row gap-2">
        <Button 
          variant="outline" 
          className="sm:flex-1 border-[#222] hover:bg-vegas-black text-white"
          onClick={() => navigate('/planos')}
        >
          Gerenciar plano
        </Button>
        
        {isActive && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="sm:flex-1 border-red-500/30 text-red-500 hover:bg-red-500/10"
                disabled={isCanceling}
              >
                {isCanceling ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Cancelando...</>
                ) : (
                  "Cancelar assinatura"
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-vegas-black border border-[#222]">
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar cancelamento?</AlertDialogTitle>
                <AlertDialogDescription>
                  Você continuará com acesso até o final do período atual.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-transparent border border-[#222] hover:bg-vegas-black text-white">Voltar</AlertDialogCancel>
                <AlertDialogAction 
                  className="bg-red-500 hover:bg-red-600 text-white"
                  onClick={handleCancelSubscription}
                >
                  Cancelar assinatura
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
};

export default ProfileSubscription; 