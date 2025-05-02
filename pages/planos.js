import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import ApiStatusBanner from '../components/ApiStatusBanner';

/**
 * Página de Planos
 * Exibe os planos disponíveis para assinatura e permite ao usuário selecionar um.
 */
export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSubscription, setUserSubscription] = useState(null);
  const [apiOffline, setApiOffline] = useState(false);
  
  // Dados dos planos (dados locais de backup caso a API falhe)
  const planos = [
    {
      id: 'basic',
      nome: 'Básico',
      valor: 'R$ 49,90',
      valorCentavos: 4990,
      periodo: 'mensal',
      recursos: [
        'Acesso às roletas',
        'Histórico de números',
        'Suporte por email'
      ],
      destaque: false,
      cor: 'blue'
    },
    {
      id: 'premium',
      nome: 'Premium',
      valor: 'R$ 99,90',
      valorCentavos: 9990,
      periodo: 'mensal',
      recursos: [
        'Acesso a todas as roletas',
        'Histórico completo',
        'Análises avançadas',
        'Suporte prioritário'
      ],
      destaque: true,
      cor: 'purple'
    },
    {
      id: 'pro',
      nome: 'Profissional',
      valor: 'R$ 179,90',
      valorCentavos: 17990,
      periodo: 'mensal',
      recursos: [
        'Tudo do Premium',
        'Acesso a recursos beta',
        'Consultoria personalizada',
        'API exclusiva',
        'Suporte 24/7'
      ],
      destaque: false,
      cor: 'green'
    }
  ];

  // Verificar status de assinatura ao carregar a página
  useEffect(() => {
    checkSubscription();
    // Tentar carregar os planos da API, mas usar dados locais se falhar
    loadPlans();
    // Verificar se a API está online
    checkApiAvailability();
  }, []);

  // Verificar disponibilidade da API
  const checkApiAvailability = async () => {
    try {
      // Tentar acessar endpoint de saúde ou status
      await axios.get('/api/health', { timeout: 5000 });
      setApiOffline(false);
    } catch (err) {
      // Se falhar, tentar outro endpoint
      try {
        await axios.get('/api/status', { timeout: 5000 });
        setApiOffline(false);
      } catch (err2) {
        console.warn('API parece estar offline:', err2.message);
        setApiOffline(true);
      }
    }
  };

  // Função para carregar planos da API (ou usar dados locais se falhar)
  const loadPlans = async () => {
    try {
      // Tentar buscar planos da API
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      // Tentar primeiro o endpoint /api/subscription/status
      let response;
      try {
        response = await axios.get('/api/subscription/status', { headers });
      } catch (err) {
        console.warn('Falha ao acessar /api/subscription/status, tentando endpoint alternativo');
        
        // Se falhar, tentar o endpoint /api/assinatura/planos como fallback
        try {
          response = await axios.get('/api/assinatura/planos', { headers });
        } catch (err2) {
          // Tentar o endpoint de fallback local
          try {
            response = await axios.get('/api/subscription/fallback?endpoint=planos', { headers });
            console.log('Usando dados de fallback local');
          } catch (err3) {
            console.warn('Todos os endpoints falharam, usando dados locais');
            // Continuamos usando os dados locais
            setApiOffline(true);
            setLoading(false);
            return;
          }
        }
      }
      
      // Se conseguir dados da API, podemos usá-los aqui
      console.log('Dados de planos carregados com sucesso');
      
      // Finalizar carregamento
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar dados de planos:', err);
      // Silenciosamente falha, pois temos os dados locais como backup
      setApiOffline(true);
      setLoading(false);
    }
  };

  // Verificar status da assinatura, mas continuar mesmo que falhe
  const checkSubscription = async () => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        // Usuário não está logado, pode mostrar os planos mas sem info de assinatura
        setLoading(false);
        return;
      }
      
      // Tentar vários endpoints possíveis para verificar a assinatura
      try {
        const response = await axios.get('/api/subscription/status', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.hasActiveSubscription) {
          setUserSubscription(response.data.subscription);
        }
      } catch (err1) {
        console.warn('Falha ao verificar assinatura em /api/subscription/status:', err1.message);
        
        // Tentar endpoint alternativo
        try {
          const altResponse = await axios.get('/api/assinatura/status', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          if (altResponse.data.hasActiveSubscription) {
            setUserSubscription(altResponse.data.subscription);
          }
        } catch (err2) {
          // Tentar endpoint de fallback local
          try {
            const fallbackResponse = await axios.get('/api/subscription/fallback?endpoint=status', {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (fallbackResponse.data.hasActiveSubscription) {
              setUserSubscription(fallbackResponse.data.subscription);
            }
          } catch (err3) {
            console.warn('Todos os endpoints de assinatura falharam:', err3.message);
            // Continuar sem dados de assinatura
            setApiOffline(true);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao verificar assinatura:', err);
      setApiOffline(true);
    } finally {
      // Sempre finalizar o carregamento, mesmo em caso de erro
      setLoading(false);
    }
  };

  // Função para iniciar o checkout de um plano
  const iniciarCheckout = async (plano) => {
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        // Redirecionar para login se não estiver autenticado
        router.push('/login?redirect=/planos');
        return;
      }
      
      setLoading(true);
      
      // Se a API estiver offline, usar simulação de checkout
      if (apiOffline) {
        console.log('API offline, redirecionando para simulação de checkout');
        window.location.href = `/api/checkout/simulation?planId=${plano.id}`;
        return;
      }
      
      // Tentar iniciar checkout em diversos endpoints possíveis
      let response;
      let checkoutUrl;
      
      try {
        // Tentar primeiro o endpoint principal
        response = await axios.post('/api/checkout/create', {
          planId: plano.id,
          value: plano.valorCentavos,
          billingCycle: plano.periodo
        }, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        checkoutUrl = response.data.checkoutUrl;
      } catch (err1) {
        console.warn('Falha no endpoint principal de checkout, tentando alternativa:', err1.message);
        
        // Tentar endpoint alternativo
        try {
          response = await axios.post('/api/assinatura/checkout', {
            planId: plano.id,
            value: plano.valorCentavos,
            billingCycle: plano.periodo
          }, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          checkoutUrl = response.data.checkoutUrl;
        } catch (err2) {
          // Tentar endpoint de fallback local
          try {
            response = await axios.post('/api/checkout/fallback', {
              planId: plano.id,
              value: plano.valorCentavos,
              billingCycle: plano.periodo
            }, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            checkoutUrl = response.data.checkoutUrl;
          } catch (err3) {
            console.error('Todos os endpoints de checkout falharam:', err3.message);
            // Redirecionar para simulação de checkout como último recurso
            window.location.href = `/api/checkout/simulation?planId=${plano.id}`;
            return;
          }
        }
      }
      
      // Redirecionar para a URL de checkout do Asaas
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        // Se não conseguiu URL, tenta a simulação
        window.location.href = `/api/checkout/simulation?planId=${plano.id}`;
      }
    } catch (err) {
      console.error('Erro ao iniciar checkout:', err);
      setError('Erro ao iniciar o processo de pagamento. Usando simulação...');
      setTimeout(() => {
        window.location.href = `/api/checkout/simulation?planId=${plano.id}`;
      }, 2000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Planos de Assinatura | RunCash</title>
        <meta name="description" content="Escolha o plano ideal para maximizar seus resultados" />
      </Head>

      {/* Banner principal */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 py-12 px-4 text-white text-center">
        <h1 className="text-4xl font-bold mb-4">Planos e Preços</h1>
        <p className="text-xl max-w-3xl mx-auto">
          Escolha o plano ideal para acessar os dados das roletas em tempo real e
          maximizar suas oportunidades.
        </p>
        
        {/* Mostrar mensagem se o usuário já tem assinatura */}
        {userSubscription && (
          <div className="mt-6 bg-white text-blue-800 p-4 rounded-lg max-w-2xl mx-auto">
            <p className="font-bold">
              Você já possui o plano {userSubscription.plan}
            </p>
            <p className="text-sm mt-2">
              Sua assinatura está {userSubscription.status === 'ACTIVE' ? 'ativa' : 'pendente'}
              {userSubscription.nextDueDate && (
                <span> e será renovada em {new Date(userSubscription.nextDueDate).toLocaleDateString()}</span>
              )}
            </p>
          </div>
        )}
        
        {/* Banner de modo simulação se API estiver offline */}
        {apiOffline && (
          <div className="mt-6 bg-amber-100 text-amber-800 p-4 rounded-lg max-w-2xl mx-auto">
            <p className="font-bold flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Modo de Simulação Ativo
            </p>
            <p className="text-sm mt-2">
              O sistema está operando em modo de simulação. As assinaturas feitas agora serão apenas para demonstração.
            </p>
          </div>
        )}
      </div>

      {/* Lista de planos */}
      <div className="max-w-7xl mx-auto py-12 px-4">
        {/* Banner de status da API */}
        <ApiStatusBanner />
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
        {loading ? (
          <div className="text-center py-10">
            <svg className="animate-spin h-10 w-10 text-purple-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-gray-600">Carregando planos disponíveis...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {planos.map((plano) => (
              <div 
                key={plano.id} 
                className={`
                  rounded-lg shadow-lg overflow-hidden 
                  ${plano.destaque ? 'transform md:scale-105 border-2 border-purple-500' : 'border border-gray-200'}
                `}
              >
                <div className={`p-6 bg-${plano.cor}-100 border-b`}>
                  <h3 className="text-2xl font-bold text-gray-800">{plano.nome}</h3>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-gray-900">{plano.valor}</span>
                    <span className="text-gray-600">/{plano.periodo}</span>
                  </div>
                </div>
                
                <div className="p-6 bg-white">
                  <ul className="space-y-3">
                    {plano.recursos.map((recurso, idx) => (
                      <li key={idx} className="flex items-start">
                        <svg 
                          className={`h-5 w-5 text-${plano.cor}-500 mr-2`} 
                          fill="currentColor" 
                          viewBox="0 0 20 20"
                        >
                          <path 
                            fillRule="evenodd" 
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" 
                            clipRule="evenodd" 
                          />
                        </svg>
                        <span className="text-gray-700">{recurso}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <button
                    onClick={() => iniciarCheckout(plano)}
                    disabled={loading || (userSubscription?.plan?.toUpperCase() === plano.id.toUpperCase())}
                    className={`
                      mt-6 w-full py-3 px-4 rounded-md font-semibold text-white
                      ${userSubscription?.plan?.toUpperCase() === plano.id.toUpperCase() 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : `bg-${plano.cor}-600 hover:bg-${plano.cor}-700`}
                      transition duration-200
                    `}
                  >
                    {userSubscription?.plan?.toUpperCase() === plano.id.toUpperCase() 
                      ? 'Seu plano atual' 
                      : loading 
                        ? 'Carregando...' 
                        : apiOffline 
                          ? 'Simular assinatura' 
                          : 'Assinar agora'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-12 text-center">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            Dúvidas sobre nossos planos?
          </h3>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Entre em contato com nosso suporte pelo email suporte@runcash.app
          </p>
        </div>
      </div>
    </div>
  );
} 