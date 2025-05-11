import { useState, useEffect } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';
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
  const { currentSubscription, currentPlan, loading, cancelSubscription, loadUserSubscription } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isCanceling, setIsCanceling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  
  // Carregar histórico de pagamentos quando a assinatura mudar
  useEffect(() => {
    if (currentSubscription) {
      fetchPaymentHistory();
    }
  }, [currentSubscription?.id]);
  
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
  
  // Atualizar dados da assinatura
  const refreshSubscriptionData = async () => {
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
  
  // Calcular progresso do ciclo de cobrança
  const calculateCycleProgress = () => {
    if (!currentSubscription || !currentSubscription.nextBillingDate) return 0;
    
    const nextDueDate = new Date(currentSubscription.nextBillingDate);
    const currentDate = new Date();
    
    // Para calcular o início do ciclo, subtraímos o período de um mês da próxima data de vencimento
    const cycleStartDate = new Date(nextDueDate);
    cycleStartDate.setMonth(cycleStartDate.getMonth() - 1);
    
    // Duração total do ciclo em milissegundos
    const cycleDuration = nextDueDate.getTime() - cycleStartDate.getTime();
    
    // Tempo decorrido desde o início do ciclo
    const timeElapsed = currentDate.getTime() - cycleStartDate.getTime();
    
    // Calcular porcentagem
    let progressPercent = Math.floor((timeElapsed / cycleDuration) * 100);
    
    // Garantir que está dentro dos limites de 0-100
    progressPercent = Math.max(0, Math.min(100, progressPercent));
    
    return progressPercent;
  };

  if (loading || loadingPayments) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-vegas-green" />
      </div>
    );
  }

  if (!currentPlan || !currentSubscription) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-vegas-darkbg rounded-lg space-y-4">
        <AlertTriangle className="h-12 w-12 text-vegas-gold mb-2" />
        <h3 className="text-xl font-bold text-white">Sem assinatura ativa</h3>
        <p className="text-center text-gray-400 mb-4">
          Você não possui uma assinatura ativa no momento.
        </p>
        <Button 
          onClick={() => navigate('/planos')}
          className="bg-vegas-green hover:bg-vegas-green/90 text-black w-full md:w-auto"
        >
          Ver planos disponíveis <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Sua Assinatura</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshSubscriptionData}
          disabled={isRefreshing}
          className="h-8 border-vegas-green text-vegas-green hover:bg-vegas-green/10"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      <div className="p-4 border border-border rounded-lg bg-vegas-black">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <div>
            <h4 className="text-xl font-bold text-white">{currentPlan.name || 'Profissional'}</h4>
            <p className="text-vegas-gold">{`R$ ${(currentPlan.price || 0).toFixed(2)}/mês`}</p>
          </div>
          <Badge className="mt-2 md:mt-0 px-3 py-1 bg-yellow-500/20 text-yellow-500 border-yellow-500">
            {currentSubscription.status === 'active' ? 'Ativo' : 'Pagamento Pendente'}
          </Badge>
        </div>

        <div className="mb-6">
          <div className="flex justify-between mb-1 text-sm">
            <span>Progresso do ciclo atual</span>
            <span>{calculateCycleProgress()}%</span>
          </div>
          <Progress value={calculateCycleProgress()} className="h-2 bg-vegas-darkbg">
            <div className="h-full bg-gradient-to-r from-vegas-green to-vegas-green-light rounded-full" />
          </Progress>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-400">Data de início</p>
            <p className="text-white">{formatDate(currentSubscription.startDate)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Próxima cobrança</p>
            <p className="text-white">{formatDate(currentSubscription.nextBillingDate)}</p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-3 mt-4">
          <Button
            variant="outline"
            className="border-vegas-green text-vegas-green hover:bg-vegas-green/10"
            onClick={() => navigate('/planos')}
          >
            Gerenciar plano
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500/10"
                disabled={isCanceling}
              >
                {isCanceling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cancelar assinatura
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-vegas-black border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ao cancelar, sua assinatura permanecerá ativa até o fim do período atual.
                  Após esse período, você perderá acesso aos recursos premium.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-vegas-darkbg text-white border-border hover:bg-vegas-darkbg/80">Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleCancelSubscription}
                  className="bg-red-500 text-white hover:bg-red-600"
                >
                  Confirmar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Lista simplificada de recursos */}
      <div className="p-4 border border-border rounded-lg bg-vegas-black">
        <h4 className="text-lg font-bold mb-4">Recursos incluídos</h4>
        <ul className="space-y-2">
          {currentPlan.features?.map((feature: string, index: number) => (
            <li key={index} className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-vegas-green/20 flex items-center justify-center mr-3">
                <div className="h-2 w-2 rounded-full bg-vegas-green"></div>
              </div>
              <span>{feature}</span>
            </li>
          )) || [
            "Acesso a estatísticas avançadas",
            "Visualização de roletas ilimitadas",
            "Visualização completa dos cartões de roleta",
            "Acesso ao painel lateral de estatísticas",
            "Atualizações a cada 1 minuto",
            "Suporte prioritário",
            "Alertas personalizados"
          ].map((feature, index) => (
            <li key={index} className="flex items-center">
              <div className="h-4 w-4 rounded-full bg-vegas-green/20 flex items-center justify-center mr-3">
                <div className="h-2 w-2 rounded-full bg-vegas-green"></div>
              </div>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ProfileSubscription; 