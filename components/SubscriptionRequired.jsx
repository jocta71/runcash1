import React from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

/**
 * Componente que é exibido quando o usuário tenta acessar um recurso
 * que requer assinatura, mas não tem uma assinatura ativa.
 * 
 * @param {Object} props Propriedades do componente
 * @param {string} props.message Mensagem personalizada a ser exibida
 * @param {string} props.planRequired Plano necessário para acessar o recurso
 * @param {string} props.currentPlan Plano atual do usuário (se houver)
 */
const SubscriptionRequired = ({ 
  message = "Este recurso requer uma assinatura ativa", 
  planRequired = "Básico", 
  currentPlan = null
}) => {
  const router = useRouter();

  const goToPlans = () => {
    router.push('/planos');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <div className="mb-6">
          <svg 
            className="h-16 w-16 text-yellow-500 mx-auto" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          Acesso Restrito
        </h2>
        
        <p className="text-gray-600 mb-6">
          {message}
        </p>
        
        <div className="bg-gray-100 p-4 rounded-md mb-6">
          <p className="text-gray-700">
            <span className="font-semibold">Plano necessário:</span> {planRequired}
          </p>
          
          {currentPlan && (
            <p className="text-gray-700 mt-2">
              <span className="font-semibold">Seu plano atual:</span> {currentPlan}
            </p>
          )}
        </div>
        
        <div className="flex flex-col space-y-3">
          <button
            onClick={goToPlans}
            className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-md transition duration-200"
          >
            Ver planos disponíveis
          </button>
          
          <Link href="/" className="text-purple-600 hover:text-purple-800">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionRequired; 