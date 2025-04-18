import React, { useEffect, useState } from 'react';
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
  Loader2 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/context/SubscriptionContext';
import { useToast } from '@/hooks/use-toast';
import SubscriptionDetails from '@/components/SubscriptionDetails';
import { Skeleton } from '@/components/ui/skeleton';

const ProfileSubscription = () => {
  const { currentPlan, currentSubscription, loading, error, refreshSubscription } = useSubscription();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  // Atualizar dados da assinatura
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSubscription();
      toast({
        title: "Dados atualizados",
        description: "As informações da sua assinatura foram atualizadas.",
      });
    } catch (err) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar os dados da assinatura. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setRefreshing(false);
    }
  };

  // Redirecionamento para a página de planos
  const handleViewPlans = () => {
    navigate('/planos');
  };

  // Se estiver carregando, exibir skeleton
  if (loading) {
    return (
      <Card className="border-gray-700 bg-vegas-black/30">
        <CardHeader>
          <Skeleton className="h-6 w-[180px] mb-2" />
          <Skeleton className="h-4 w-[250px]" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center space-y-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="space-y-2 w-full">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Skeleton className="h-10 w-full" />
        </CardFooter>
      </Card>
    );
  }

  // Se houver erro, exibir mensagem
  if (error) {
    return (
      <Card className="border-gray-700 bg-vegas-black/30">
        <CardHeader>
          <CardTitle>Erro ao carregar assinatura</CardTitle>
          <CardDescription>
            Não foi possível carregar as informações da sua assinatura
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
          <p className="text-center text-gray-400 mb-6">
            Ocorreu um erro ao carregar os dados da sua assinatura. Por favor, tente novamente mais tarde.
          </p>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Atualizando...</> : 
              'Tentar novamente'
            }
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Se não tiver assinatura, exibir opção para ver planos
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
            onClick={handleViewPlans}
          >
            Ver planos disponíveis
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Se tiver assinatura, exibir detalhes
  return (
    <SubscriptionDetails
      subscriptionId={currentSubscription.id}
      planName={currentPlan?.name || 'Desconhecido'}
      status={currentSubscription.status}
      startDate={currentSubscription.startDate}
      endDate={currentSubscription.endDate}
      nextBillingDate={currentSubscription.nextBillingDate}
      value={currentSubscription.value || currentPlan?.price || 0}
      onRefresh={handleRefresh}
    />
  );
};

export default ProfileSubscription; 