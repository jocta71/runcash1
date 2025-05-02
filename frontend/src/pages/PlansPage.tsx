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
import { CheckCircle } from 'lucide-react';

// Estilos
import '../styles/plans.css';

// Planos padrão a serem exibidos caso a API falhe
const defaultPlans = [
  {
    id: 'mensal',
    nome: 'Plano Mensal',
    valor: 29.90,
    intervalo: 'mensal',
    descricao: 'Acesso a recursos premium por 1 mês',
    recursos: [
      'Acesso aos dados de todas as roletas',
      'Histórico de números das roletas',
      'Estatísticas básicas',
      'Exportação de dados CSV'
    ]
  },
  {
    id: 'trimestral',
    nome: 'Plano Trimestral',
    valor: 79.90,
    intervalo: 'trimestral',
    descricao: 'Acesso a recursos premium por 3 meses',
    recursos: [
      'Acesso aos dados de todas as roletas',
      'Histórico de números das roletas',
      'Estatísticas avançadas',
      'Exportação de dados CSV',
      'Alerta de números quentes'
    ],
    economia: '11% de desconto em relação ao plano mensal'
  },
  {
    id: 'anual',
    nome: 'Plano Anual',
    valor: 299.90,
    intervalo: 'anual',
    descricao: 'Acesso a recursos premium por 12 meses',
    recursos: [
      'Acesso aos dados de todas as roletas',
      'Histórico de números das roletas',
      'Estatísticas avançadas',
      'Exportação de dados CSV',
      'Alerta de números quentes',
      'Atualização em tempo real',
      'Análise de padrões com IA',
      'Suporte prioritário'
    ],
    economia: '16% de desconto em relação ao plano mensal'
  }
];

const PlansPage: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [plans, setPlans] = useState<any[]>(defaultPlans);
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
        // Não definimos o erro aqui porque usaremos os planos padrão
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

  return (
    <div className="container mx-auto py-12 px-4 max-w-7xl">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Planos e Preços</h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          Escolha o plano ideal para acessar os dados das roletas em tempo real e maximizar suas oportunidades.
        </p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center my-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 mt-8">
          {plans.map((plan) => (
            <Card key={plan.id} className={`flex flex-col border-2 ${plan.id === 'trimestral' ? 'border-primary shadow-lg' : 'border-border'}`}>
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
                  <Badge variant="outline" className="mb-4 bg-green-50">
                    {plan.economia}
                  </Badge>
                )}
                
                <ul className="space-y-2 mt-6">
                  {plan.recursos.map((recurso: string, index: number) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-500" />
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