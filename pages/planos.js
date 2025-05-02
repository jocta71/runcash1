import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';

/**
 * Página de Planos
 * Exibe os planos disponíveis para assinatura e permite ao usuário selecionar um.
 */
export default function PlanosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userSubscription, setUserSubscription] = useState(null);
  
  // Dados dos planos (poderiam vir da API)
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
    async function checkSubscription() {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          // Usuário não está logado, pode mostrar os planos mas sem info de assinatura
          setLoading(false);
          return;
        }
        
        const response = await axios.get('/api/subscription/status', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (response.data.hasActiveSubscription) {
          setUserSubscription(response.data.subscription);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Erro ao verificar assinatura:', err);
        setError('Não foi possível verificar sua assinatura');
        setLoading(false);
      }
    }
    
    checkSubscription();
  }, []);

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
      
      // Iniciar checkout no Asaas
      const response = await axios.post('/api/checkout/create', {
        planId: plano.id,
        value: plano.valorCentavos,
        billingCycle: plano.periodo
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      // Redirecionar para a URL de checkout do Asaas
      if (response.data.checkoutUrl) {
        window.location.href = response.data.checkoutUrl;
      } else {
        setError('Não foi possível iniciar o checkout');
        setLoading(false);
      }
    } catch (err) {
      console.error('Erro ao iniciar checkout:', err);
      setError('Erro ao iniciar o processo de pagamento');
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
        <h1 className="text-4xl font-bold mb-4">Planos de Assinatura</h1>
        <p className="text-xl max-w-3xl mx-auto">
          Escolha o plano ideal para acessar nossas roletas e recursos exclusivos
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
      </div>

      {/* Lista de planos */}
      <div className="max-w-7xl mx-auto py-12 px-4">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}
        
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
                    : loading ? 'Carregando...' : 'Assinar agora'}
                </button>
              </div>
            </div>
          ))}
        </div>
        
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