import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertTriangle,
  CreditCard,
  Clock,
  Check,
  X,
  Loader2,
  FileText,
  Calendar,
  RefreshCw
} from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Interface para pagamentos/faturas
interface Invoice {
  id: string;
  amount: number;
  status: string;
  date: Date;
  dueDate?: Date;
  paymentMethod?: string;
}

const SubscriptionManagePage = () => {
  const { user, isAuthenticated } = useAuth();
  const { currentPlan, availablePlans, loading, cancelSubscription } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  
  // Buscar faturas e histórico de pagamentos
  useEffect(() => {
    const fetchInvoices = async () => {
      if (!isAuthenticated || !user) return;
      
      try {
        setLoadingInvoices(true);
        
        // Simulação de dados - em produção, substituir por chamada à API
        // Exemplo: const response = await axios.get('/api/invoices');
        setTimeout(() => {
          const mockInvoices: Invoice[] = [
            {
              id: '067789cf-ee66-46a5-9968-059b7b8ed3ef',
              amount: currentPlan?.price || 0,
              status: 'paid',
              date: new Date(),
              paymentMethod: 'pix'
            },
            {
              id: '98765432-abcd-efgh-ijkl-123456789012',
              amount: currentPlan?.price || 0,
              status: 'paid',
              date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 dias atrás
              paymentMethod: 'pix'
            }
          ];
          
          setInvoices(mockInvoices);
          setLoadingInvoices(false);
        }, 1500);
      } catch (error) {
        console.error('Erro ao buscar faturas:', error);
        toast({
          title: 'Erro ao buscar faturas',
          description: 'Não foi possível carregar seu histórico de pagamentos.',
          variant: 'destructive'
        });
        setLoadingInvoices(false);
      }
    };
    
    fetchInvoices();
  }, [isAuthenticated, user, toast, currentPlan]);
  
  // Verificar autenticação
  useEffect(() => {
    if (!isAuthenticated) {
      toast({
        title: 'Acesso negado',
        description: 'Você precisa estar logado para acessar esta página.',
        variant: 'destructive'
      });
      navigate('/login', { state: { returnUrl: '/assinatura' } });
    }
  }, [isAuthenticated, navigate, toast]);
  
  // Função para lidar com cancelamento de assinatura
  const handleCancelSubscription = async () => {
    if (!currentPlan) {
      toast({
        title: 'Nenhuma assinatura ativa',
        description: 'Você não possui uma assinatura ativa para cancelar.',
        variant: 'destructive'
      });
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Chamar a função de cancelamento do contexto
      await cancelSubscription(cancelReason);
      
      setShowCancelDialog(false);
      
      toast({
        title: 'Assinatura cancelada',
        description: 'Sua assinatura foi cancelada com sucesso.',
        variant: 'default'
      });
      
      // Redirecionar para página de planos após breve delay
      setTimeout(() => {
        navigate('/planos');
      }, 3000);
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast({
        title: 'Erro no cancelamento',
        description: 'Não foi possível cancelar sua assinatura. Por favor, tente novamente mais tarde.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Formatar data
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };
  
  if (loading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-vegas-gold" />
        <span className="ml-2 text-gray-400">Carregando informações da assinatura...</span>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen bg-vegas-black">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <h1 className="text-2xl font-bold text-vegas-gold mb-8">Gerenciar Assinatura</h1>
        
        {/* Card de Status da Assinatura */}
        <Card className="bg-vegas-black/60 border-gray-800 mb-8">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Status da Assinatura</CardTitle>
              {currentPlan ? (
                <Badge className="bg-vegas-gold text-black">
                  {currentPlan.name}
                </Badge>
              ) : (
                <Badge className="bg-gray-700 text-gray-300">
                  Sem plano ativo
                </Badge>
              )}
            </div>
            <CardDescription>
              Informações sobre sua assinatura atual
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {currentPlan ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm text-gray-400">Plano</h3>
                    <p className="font-medium">{currentPlan.name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Valor</h3>
                    <p className="font-medium">R$ {currentPlan.price.toFixed(2)}/mês</p>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Status</h3>
                    <div className="flex items-center">
                      <Check className="w-4 h-4 text-green-500 mr-1" />
                      <span>Ativo</span>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm text-gray-400">Próxima renovação</h3>
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 text-vegas-gold mr-1" />
                      <span>{formatDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))}</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-vegas-black/40 p-4 rounded-md border border-gray-800">
                  <div className="flex items-start">
                    <RefreshCw className="w-4 h-4 text-vegas-gold mt-1 mr-2" />
                    <div>
                      <h3 className="font-medium">Renovação automática</h3>
                      <p className="text-sm text-gray-400 mt-1">
                        Sua assinatura será renovada automaticamente a cada mês. Você pode cancelar a qualquer momento.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma assinatura ativa</h3>
                <p className="text-gray-400 mb-4">
                  Você não possui uma assinatura ativa no momento. Escolha um plano para começar.
                </p>
                <Button
                  onClick={() => navigate('/planos')}
                  className="bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                >
                  Ver Planos Disponíveis
                </Button>
              </div>
            )}
          </CardContent>
          
          {currentPlan && (
            <CardFooter className="border-t border-gray-800 pt-4 flex flex-col items-start">
              <Button
                variant="outline"
                className="border-red-700 text-red-500 hover:bg-red-950/30 hover:text-red-400"
                onClick={() => setShowCancelDialog(true)}
              >
                Cancelar Assinatura
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Ao cancelar, você terá acesso até o final do período já pago.
              </p>
            </CardFooter>
          )}
        </Card>
        
        {/* Card de Histórico de Pagamentos */}
        {currentPlan && (
          <Card className="bg-vegas-black/60 border-gray-800">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                Histórico de Pagamentos
              </CardTitle>
              <CardDescription>
                Visualize seu histórico de pagamentos e faturas
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {loadingInvoices ? (
                <div className="text-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-vegas-gold" />
                  <p className="text-gray-400">Carregando histórico de pagamentos...</p>
                </div>
              ) : invoices.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="text-left py-3 px-2 text-sm text-gray-400">Data</th>
                        <th className="text-left py-3 px-2 text-sm text-gray-400">Fatura</th>
                        <th className="text-left py-3 px-2 text-sm text-gray-400">Valor</th>
                        <th className="text-left py-3 px-2 text-sm text-gray-400">Status</th>
                        <th className="text-left py-3 px-2 text-sm text-gray-400">Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-gray-800">
                          <td className="py-3 px-2">{formatDate(invoice.date)}</td>
                          <td className="py-3 px-2">
                            <span className="text-sm text-gray-300">
                              {invoice.id.slice(0, 8)}...
                            </span>
                          </td>
                          <td className="py-3 px-2">R$ {invoice.amount.toFixed(2)}</td>
                          <td className="py-3 px-2">
                            <Badge className={
                              invoice.status === 'paid' 
                                ? 'bg-green-950 text-green-500 hover:bg-green-950' 
                                : 'bg-yellow-950 text-yellow-500 hover:bg-yellow-950'
                            }>
                              {invoice.status === 'paid' ? 'Pago' : 'Pendente'}
                            </Badge>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center">
                              <CreditCard className="w-4 h-4 mr-1 text-vegas-gold" />
                              <span className="capitalize">{invoice.paymentMethod}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400">Nenhum pagamento registrado ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      
      {/* Diálogo de Cancelamento */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="bg-vegas-black border-gray-800">
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja cancelar sua assinatura {currentPlan?.name}?
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Motivo do cancelamento (opcional):
              </label>
              <textarea 
                className="w-full bg-vegas-black/40 border border-gray-700 rounded-md p-2"
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Conte-nos por que está cancelando..."
              />
            </div>
            
            <div className="bg-vegas-black/40 p-3 rounded-md border border-gray-800">
              <p className="text-sm text-gray-400">
                Ao cancelar sua assinatura, você ainda terá acesso até o final do período atual já pago.
                Após esse período, seu acesso aos recursos premium será encerrado.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCancelDialog(false)}
              disabled={isLoading}
            >
              Manter Assinatura
            </Button>
            <Button 
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processando...
                </>
              ) : (
                <>
                  <X className="h-4 w-4 mr-2" />
                  Confirmar Cancelamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionManagePage; 