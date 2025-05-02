import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Componentes UI
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CheckCircle, AlertCircle } from 'lucide-react';

// Estilos
import '../styles/plans.css';

const PlansPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const navigate = useNavigate();

  // Buscar planos disponíveis e status da assinatura do usuário
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Buscar planos disponíveis
        const plansResponse = await axios.get('/api/assinatura/planos');
        if (plansResponse.data && plansResponse.data.success) {
          setPlans(plansResponse.data.data.planos);
        }

        // Buscar status da assinatura do usuário (se estiver logado)
        const token = localStorage.getItem('token');
        if (token) {
          const subscriptionResponse = await axios.get('/api/assinatura/status', {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (subscriptionResponse.data && subscriptionResponse.data.success) {
            setUserSubscription(subscriptionResponse.data.data);
          }
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados de planos:', err);
        setError('Não foi possível carregar os planos disponíveis. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Iniciar checkout do Asaas
  const handleCheckout = async (planId: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        // Redirecionar para login se não estiver autenticado
        navigate('/auth?redirect=plans');
        return;
      }

      // Solicitar criação de checkout ao backend
      const response = await axios.post('/api/assinatura/checkout', 
        { planoId: planId },
        { headers: { Authorization: `Bearer ${token}` }}
      );

      if (response.data && response.data.success && response.data.checkoutUrl) {
        // Redirecionar para o checkout do Asaas
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Não foi possível iniciar o checkout. Tente novamente.');
      }
    } catch (err: any) {
      console.error('Erro ao iniciar checkout:', err);
      setError(err.response?.data?.message || 'Erro ao processar a solicitação');
    } finally {
      setLoading(false);
    }
  };
  
  // Tentar novamente, se houver erro
  const handleRetry = () => {
    setError(null);
    const fetchData = async () => {
      setLoading(true);
      try {
        const plansResponse = await axios.get('/api/assinatura/planos');
        if (plansResponse.data && plansResponse.data.success) {
          setPlans(plansResponse.data.data.planos);
        }
      } catch (err: any) {
        console.error('Erro ao carregar dados de planos:', err);
        setError('Não foi possível carregar os planos disponíveis. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  };

  return (
    <div className="container mx-auto py-12 px-4 max-w-7xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Planos e Preços</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Escolha o plano ideal para acessar os dados das roletas em tempo real e maximizar suas oportunidades.
        </p>
      </div>

      {loading && !plans.length ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : error ? (
        <div className="max-w-md mx-auto my-16 text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-8 shadow-sm">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-red-700 mb-4">Não foi possível carregar os planos disponíveis.</h2>
            <p className="text-gray-600 mb-6">Tente novamente mais tarde.</p>
            <Button 
              onClick={handleRetry} 
              variant="outline" 
              className="mx-auto"
            >
              Tentar Novamente
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 mt-8">
          {plans.map((plan) => (
            <Card key={plan.id} className={`flex flex-col border-2 ${plan.id === 'trimestral' ? 'border-primary shadow-lg' : 'border-border'} transition-all duration-300 hover:shadow-md`}>
              {plan.id === 'trimestral' && (
                <div className="bg-primary text-primary-foreground text-center py-1 font-medium text-sm">
                  MAIS POPULAR
                </div>
              )}
              
              <CardHeader>
                <CardTitle className="text-2xl">{plan.nome}</CardTitle>
                <CardDescription>{plan.descricao}</CardDescription>
              </CardHeader>
              
              <CardContent className="flex-grow">
                <div className="mb-6">
                  <span className="text-4xl font-bold">R$ {plan.valor.toFixed(2).replace('.', ',')}</span>
                  <span className="text-muted-foreground">/{plan.intervalo}</span>
                </div>
                
                {plan.economia && (
                  <Badge variant="outline" className="mb-4 bg-green-50 text-green-700 border-green-200">
                    {plan.economia}
                  </Badge>
                )}
                
                <ul className="space-y-2 mt-6">
                  {plan.recursos.map((recurso: string, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span>{recurso}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              
              <CardFooter>
                <Button 
                  className="w-full" 
                  variant={plan.id === 'trimestral' ? 'default' : 'outline'}
                  disabled={loading || (userSubscription?.possuiAssinatura && userSubscription?.plano === plan.id)}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {userSubscription?.possuiAssinatura && userSubscription?.plano === plan.id
                    ? 'Plano Atual'
                    : 'Assinar Agora'}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
      
      <div className="mt-12 text-center text-muted-foreground">
        <p>
          Pagamentos processados de forma segura através do Asaas. <br />
          Você pode cancelar sua assinatura a qualquer momento.
        </p>
      </div>
    </div>
  );
};

export default PlansPage; 