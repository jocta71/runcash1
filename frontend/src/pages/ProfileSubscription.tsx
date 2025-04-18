import { useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Loader2, CreditCard, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const ProfileSubscription = () => {
  const { currentSubscription, currentPlan, loading, cancelSubscription } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isCanceling, setIsCanceling] = useState(false);
  
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
  
  // Determinar badge de status
  const getStatusBadge = (status: string) => {
    switch (status) {
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
  
  // Determinar ícone de status
  const getStatusIcon = (status: string) => {
    switch (status) {
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
  
  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-vegas-gold" />
      </div>
    );
  }
  
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
  
  return (
    <Card className="border-gray-700 bg-vegas-black/30">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Sua Assinatura</CardTitle>
          <CardDescription>
            Detalhes da sua assinatura atual
          </CardDescription>
        </div>
        {getStatusIcon(currentSubscription.status)}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row md:justify-between gap-4">
          <div>
            <h3 className="font-medium text-gray-400 mb-1">Plano</h3>
            <p className="text-xl font-bold">{currentPlan?.name || 'Desconhecido'}</p>
          </div>
          <div>
            <h3 className="font-medium text-gray-400 mb-1">Status</h3>
            <div>{getStatusBadge(currentSubscription.status)}</div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row md:justify-between gap-4 pt-2">
          <div>
            <h3 className="font-medium text-gray-400 mb-1">Data de início</h3>
            <p>{formatDate(currentSubscription.startDate)}</p>
          </div>
          {currentSubscription.nextBillingDate && (
            <div>
              <h3 className="font-medium text-gray-400 mb-1">Próxima cobrança</h3>
              <p>{formatDate(currentSubscription.nextBillingDate)}</p>
            </div>
          )}
        </div>
        
        {currentSubscription.paymentMethod && (
          <div className="pt-2">
            <h3 className="font-medium text-gray-400 mb-1">Forma de pagamento</h3>
            <p className="flex items-center">
              <CreditCard className="h-4 w-4 mr-2" />
              {currentSubscription.paymentMethod}
            </p>
          </div>
        )}
        
        {/* Exibir recursos do plano atual */}
        {currentPlan && (
          <div className="pt-4 mt-2 border-t border-gray-700">
            <h3 className="font-medium mb-2">Recursos incluídos:</h3>
            <ul className="space-y-1">
              {currentPlan.features.map((feature, index) => (
                <li key={index} className="text-sm text-gray-300 flex items-start">
                  <span className="text-vegas-gold mr-2">✓</span> {feature}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex flex-col sm:flex-row gap-3">
        <Button 
          className="flex-1 bg-vegas-gold hover:bg-vegas-gold/80 text-black"
          onClick={() => navigate('/planos')}
        >
          Mudar de plano
        </Button>
        
        {currentSubscription.status === 'active' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button 
                variant="outline" 
                className="flex-1 border-red-600 text-red-600 hover:bg-red-600/10"
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
      </CardFooter>
    </Card>
  );
};

export default ProfileSubscription; 