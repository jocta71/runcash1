import { useState, useEffect } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Check, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import axios from 'axios';

// Tipos para os planos
interface Plan {
  id: string;
  name: string;
  price: number;
  interval: string;
  description: string;
  features: string[];
  popular?: boolean;
  discount?: string;
  asaasId?: string;
}

const PlansPage = () => {
  const { currentPlan, loading: subscriptionLoading } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Buscar planos disponíveis
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Obter planos da API
        const response = await axios.get('/api/subscription/plans');
        
        if (response.data && response.data.success && response.data.data?.planos) {
          setPlans(response.data.data.planos.map((plan: any) => ({
            id: plan.id,
            name: plan.nome,
            price: plan.valor,
            interval: plan.intervalo,
            description: plan.descricao,
            features: plan.recursos || [],
            popular: plan.id === 'trimestral',
            discount: plan.economia,
            asaasId: plan.asaasId
          })));
        } else {
          // Planos padrão caso a API não retorne
          setPlans([
            {
              id: 'mensal',
              name: 'Plano Mensal',
              price: 49.90,
              interval: 'mensal',
              description: 'Acesso a todos os recursos por 1 mês',
              features: [
                'Acesso a todas as roletas',
                'Estatísticas em tempo real',
                'Histórico completo de números',
                'Suporte por e-mail'
              ],
              asaasId: 'plan_monthly'
            },
            {
              id: 'trimestral',
              name: 'Plano Trimestral',
              price: 129.90,
              interval: 'trimestral',
              description: 'Acesso a todos os recursos por 3 meses',
              features: [
                'Acesso a todas as roletas',
                'Estatísticas em tempo real',
                'Histórico completo de números',
                'Suporte por e-mail',
                'Suporte prioritário via WhatsApp'
              ],
              popular: true,
              discount: 'Economize 13% em relação ao mensal',
              asaasId: 'plan_quarterly'
            },
            {
              id: 'anual',
              name: 'Plano Anual',
              price: 449.90,
              interval: 'anual',
              description: 'Acesso a todos os recursos por 12 meses',
              features: [
                'Acesso a todas as roletas',
                'Estatísticas em tempo real',
                'Histórico completo de números',
                'Suporte por e-mail',
                'Suporte prioritário via WhatsApp',
                'Acesso a estratégias exclusivas',
                'Acesso a futuros recursos'
              ],
              discount: 'Economize 25% em relação ao mensal',
              asaasId: 'plan_yearly'
            }
          ]);
        }
      } catch (err) {
        console.error('Erro ao carregar planos:', err);
        setError('Não foi possível carregar os planos disponíveis. Tente novamente mais tarde.');
        
        // Carregar planos padrão mesmo em caso de erro
        setPlans([
          {
            id: 'mensal',
            name: 'Plano Mensal',
            price: 49.90,
            interval: 'mensal',
            description: 'Acesso a todos os recursos por 1 mês',
            features: [
              'Acesso a todas as roletas',
              'Estatísticas em tempo real',
              'Histórico completo de números',
              'Suporte por e-mail'
            ],
            asaasId: 'plan_monthly'
          },
          {
            id: 'trimestral',
            name: 'Plano Trimestral',
            price: 129.90,
            interval: 'trimestral',
            description: 'Acesso a todos os recursos por 3 meses',
            features: [
              'Acesso a todas as roletas',
              'Estatísticas em tempo real',
              'Histórico completo de números',
              'Suporte por e-mail',
              'Suporte prioritário via WhatsApp'
            ],
            popular: true,
            discount: 'Economize 13% em relação ao mensal',
            asaasId: 'plan_quarterly'
          },
          {
            id: 'anual',
            name: 'Plano Anual',
            price: 449.90,
            interval: 'anual',
            description: 'Acesso a todos os recursos por 12 meses',
            features: [
              'Acesso a todas as roletas',
              'Estatísticas em tempo real',
              'Histórico completo de números',
              'Suporte por e-mail',
              'Suporte prioritário via WhatsApp',
              'Acesso a estratégias exclusivas',
              'Acesso a futuros recursos'
            ],
            discount: 'Economize 25% em relação ao mensal',
            asaasId: 'plan_yearly'
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleSelectPlan = async (plan: Plan) => {
    // Se já for o plano atual, apenas mostrar mensagem
    if (currentPlan?.id === plan.id) {
      toast({
        title: "Plano atual",
        description: "Você já está inscrito neste plano.",
      });
      return;
    }
    
    if (!user) {
      toast({
        title: "Login necessário",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive"
      });
      // Redirecionando para a página inicial com indicação para exibir o modal de login
      navigate('/', { state: { showLoginModal: true } });
      return;
    }

    try {
      setProcessingPayment(true);
      
      // Iniciar processo de pagamento
      const response = await axios.post('/api/checkout/create', {
        planId: plan.id,
        asaasId: plan.asaasId
      });
      
      if (response.data && response.data.success && response.data.paymentUrl) {
        // Redirecionar para a página de pagamento do Asaas
        window.location.href = response.data.paymentUrl;
      } else {
        throw new Error('Não foi possível iniciar o pagamento');
      }
    } catch (err) {
      console.error('Erro ao processar pagamento:', err);
      toast({
        title: "Erro ao processar pagamento",
        description: "Não foi possível iniciar o processo de pagamento. Tente novamente mais tarde.",
        variant: "destructive"
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading || subscriptionLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container py-8 space-y-8 max-w-7xl">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Escolha o plano ideal para você</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Tenha acesso a todas as roletas e recursos avançados para maximizar seus resultados.
            Assine agora e comece a usar imediatamente.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" className="max-w-4xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative border ${plan.popular ? 'border-primary shadow-lg' : 'border-border'}`}>
              {plan.popular && (
                <div className="absolute -top-3 left-0 right-0 mx-auto w-fit">
                  <Badge className="bg-primary text-primary-foreground">Mais popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle className="flex justify-between items-start">
                  <span>{plan.name}</span>
                  {currentPlan?.id === plan.id && (
                    <Badge variant="outline" className="ml-2">Plano atual</Badge>
                  )}
                </CardTitle>
                <div className="mt-2">
                  <span className="text-3xl font-bold">R${plan.price.toFixed(2)}</span>
                  <span className="text-muted-foreground ml-1">/{plan.interval === 'mensal' ? 'mês' : plan.interval === 'trimestral' ? 'trimestre' : 'ano'}</span>
                </div>
                {plan.discount && (
                  <p className="text-sm text-green-500 font-medium">{plan.discount}</p>
                )}
                <CardDescription className="mt-2">{plan.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <Check className="h-5 w-5 text-primary mr-2 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button 
                  className={`w-full ${plan.popular ? 'bg-primary hover:bg-primary/90' : ''}`}
                  onClick={() => handleSelectPlan(plan)}
                  disabled={currentPlan?.id === plan.id || processingPayment}
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processando
                    </>
                  ) : currentPlan?.id === plan.id ? (
                    'Plano atual'
                  ) : (
                    'Assinar agora'
                  )}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 bg-card p-6 rounded-lg border border-border max-w-4xl mx-auto space-y-4">
          <h2 className="text-xl font-bold">Perguntas frequentes</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold mb-1">Como funciona o pagamento?</h3>
              <p className="text-sm text-muted-foreground">
                Todos os pagamentos são processados com segurança através da plataforma Asaas. Aceitamos cartão de crédito, boleto e PIX.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">Posso cancelar minha assinatura?</h3>
              <p className="text-sm text-muted-foreground">
                Sim, você pode cancelar sua assinatura a qualquer momento. O acesso aos recursos permanecerá ativo até o final do período pago.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">Quanto tempo leva para ativar minha assinatura?</h3>
              <p className="text-sm text-muted-foreground">
                Com pagamentos via cartão de crédito ou PIX, a ativação é imediata. Para boletos, pode levar até 3 dias úteis após o pagamento.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1">O que acontece após o período da assinatura?</h3>
              <p className="text-sm text-muted-foreground">
                As assinaturas são renovadas automaticamente ao final do período. Você pode cancelar a renovação automática a qualquer momento na sua área de perfil.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default PlansPage; 