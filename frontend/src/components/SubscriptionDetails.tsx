import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  CalendarClock,
  RefreshCw,
  ReceiptText,
  Calendar,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { findAsaasSubscription, cancelAsaasSubscription } from '@/integrations/asaas/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNotifications } from '@/context/NotificationsContext';

// Funções auxiliares
const formatDate = (dateString: string) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value);
};

interface SubscriptionDetailsProps {
  subscriptionId: string;
  planName: string;
  status: string;
  startDate: string;
  endDate?: string;
  nextBillingDate?: string;
  value: number;
  onRefresh?: () => void;
}

const SubscriptionDetails: React.FC<SubscriptionDetailsProps> = ({
  subscriptionId,
  planName,
  status,
  startDate,
  endDate,
  nextBillingDate,
  value,
  onRefresh
}) => {
  const [loading, setLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('detalhes');
  const { toast } = useToast();
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  const { refreshSubscription } = useSubscription();

  // Buscar histórico de pagamentos quando o componente montar
  useEffect(() => {
    if (subscriptionId) {
      loadPaymentHistory();
    }
  }, [subscriptionId]);

  // Carregar histórico de pagamentos
  const loadPaymentHistory = async () => {
    setLoading(true);
    try {
      const result = await findAsaasSubscription(subscriptionId);
      if (result && result.payments) {
        setPaymentHistory(result.payments);
      }
    } catch (error) {
      console.error('Erro ao buscar histórico de pagamentos:', error);
      toast({
        title: "Erro ao carregar histórico",
        description: "Não foi possível carregar o histórico de pagamentos. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Cancelar assinatura
  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      const result = await cancelAsaasSubscription(subscriptionId);
      
      if (result && result.success) {
        toast({
          title: "Assinatura cancelada",
          description: "Sua assinatura foi cancelada com sucesso.",
        });
        
        addNotification({
          type: 'success',
          message: 'Sua assinatura foi cancelada com sucesso.',
          autoClose: true,
          duration: 5000
        });
        
        // Atualizar dados da assinatura
        if (refreshSubscription) {
          refreshSubscription();
        }
        
        if (onRefresh) {
          onRefresh();
        }
      }
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar sua assinatura. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setCancelLoading(false);
      setShowCancelDialog(false);
    }
  };

  // Recuperar ícone de status
  const getStatusIcon = () => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle2 className="h-10 w-10 text-green-500" />;
      case 'trial':
        return <Clock className="h-10 w-10 text-blue-500" />;
      case 'canceled':
        return <XCircle className="h-10 w-10 text-gray-500" />;
      case 'overdue':
        return <AlertTriangle className="h-10 w-10 text-red-500" />;
      default:
        return <CreditCard className="h-10 w-10 text-gray-400" />;
    }
  };

  // Recuperar badge de status
  const getStatusBadge = () => {
    switch (status.toLowerCase()) {
      case 'active':
        return <Badge className="bg-green-500 hover:bg-green-600">Ativa</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Período de Teste</Badge>;
      case 'canceled':
        return <Badge className="bg-gray-500 hover:bg-gray-600">Cancelada</Badge>;
      case 'overdue':
        return <Badge className="bg-red-500 hover:bg-red-600">Pagamento Atrasado</Badge>;
      default:
        return <Badge className="bg-gray-500 hover:bg-gray-600">{status}</Badge>;
    }
  };

  return (
    <Card className="border-gray-700 bg-vegas-black/30">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Assinatura {planName}</CardTitle>
            <CardDescription>
              Detalhes da sua assinatura atual
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="detalhes" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="pagamentos">Histórico de Pagamentos</TabsTrigger>
          </TabsList>
          
          <TabsContent value="detalhes">
            <div className="flex items-center justify-center mb-6">
              {getStatusIcon()}
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-vegas-gold mr-2" />
                <span className="text-gray-400">Data de início:</span>
                <span className="ml-auto font-medium">{formatDate(startDate)}</span>
              </div>
              
              {nextBillingDate && (
                <div className="flex items-center">
                  <CalendarClock className="h-5 w-5 text-vegas-gold mr-2" />
                  <span className="text-gray-400">Próxima cobrança:</span>
                  <span className="ml-auto font-medium">{formatDate(nextBillingDate)}</span>
                </div>
              )}
              
              <div className="flex items-center">
                <CreditCard className="h-5 w-5 text-vegas-gold mr-2" />
                <span className="text-gray-400">Valor:</span>
                <span className="ml-auto font-medium">{formatCurrency(value)}</span>
              </div>
              
              {status.toLowerCase() === 'canceled' && endDate && (
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-vegas-gold mr-2" />
                  <span className="text-gray-400">Acesso até:</span>
                  <span className="ml-auto font-medium">{formatDate(endDate)}</span>
                </div>
              )}
            </div>
            
            {status.toLowerCase() === 'active' && (
              <Alert className="mt-6">
                <AlertTitle>Sua assinatura está ativa</AlertTitle>
                <AlertDescription>
                  Você tem acesso a todos os recursos do plano {planName}.
                </AlertDescription>
              </Alert>
            )}
            
            {status.toLowerCase() === 'overdue' && (
              <Alert variant="destructive" className="mt-6">
                <AlertTitle>Pagamento atrasado!</AlertTitle>
                <AlertDescription>
                  Sua assinatura está com pagamento pendente. Por favor, regularize para evitar a suspensão dos serviços.
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
          
          <TabsContent value="pagamentos">
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">Histórico de pagamentos</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0" 
                  onClick={loadPaymentHistory}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              <ScrollArea className="h-[200px] mt-2">
                {paymentHistory.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentHistory.map((payment, index) => (
                        <TableRow key={payment.id || index}>
                          <TableCell>{formatDate(payment.dueDate || payment.confirmedDate || payment.createdAt)}</TableCell>
                          <TableCell>{formatCurrency(payment.value || 0)}</TableCell>
                          <TableCell>
                            {payment.status === 'CONFIRMED' ? (
                              <Badge className="bg-green-500">Pago</Badge>
                            ) : payment.status === 'PENDING' ? (
                              <Badge className="bg-yellow-500">Pendente</Badge>
                            ) : payment.status === 'OVERDUE' ? (
                              <Badge className="bg-red-500">Atrasado</Badge>
                            ) : (
                              <Badge>{payment.status}</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[150px] text-center">
                    <ReceiptText className="h-10 w-10 text-gray-400 mb-2" />
                    <p className="text-gray-400 text-sm">
                      {loading ? 'Carregando pagamentos...' : 'Nenhum pagamento encontrado'}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <CardFooter className="flex flex-col gap-2">
        <div className="flex w-full gap-2">
          <Button 
            onClick={() => navigate('/planos')}
            variant="outline" 
            className="flex-1"
          >
            Gerenciar Plano
          </Button>
          
          {status.toLowerCase() === 'active' && (
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogTrigger asChild>
                <Button 
                  variant="destructive" 
                  className="flex-1"
                >
                  Cancelar Assinatura
                </Button>
              </DialogTrigger>
              
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar assinatura</DialogTitle>
                  <DialogDescription>
                    Tem certeza que deseja cancelar sua assinatura? Você perderá acesso aos recursos premium quando o período atual expirar.
                  </DialogDescription>
                </DialogHeader>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setShowCancelDialog(false)}
                  >
                    Voltar
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    onClick={handleCancelSubscription}
                    disabled={cancelLoading}
                  >
                    {cancelLoading ? 
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</> : 
                      'Confirmar Cancelamento'
                    }
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
        
        {status.toLowerCase() === 'overdue' && (
          <Button 
            className="w-full bg-vegas-gold hover:bg-vegas-gold/80 text-black mt-2"
            onClick={() => navigate(`/pagar/${subscriptionId}`)}
          >
            Regularizar Pagamento
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default SubscriptionDetails; 