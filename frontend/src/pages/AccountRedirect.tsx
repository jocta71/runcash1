import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Componente de redirecionamento para a rota /account
 * Esta página serve como um intermediário após confirmação de pagamento
 * Redireciona automaticamente para a página de assinatura
 */
const AccountRedirect = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Adicionar pequeno atraso para garantir que o redirecionamento é perceptível
    const timer = setTimeout(() => {
      // Redirecionar para a página de assinatura
      navigate('/minha-conta/assinatura', { replace: true });
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0e0e10] text-white">
      <Loader2 className="h-12 w-12 animate-spin text-vegas-gold mb-4" />
      <h1 className="text-2xl font-bold mb-2">Redirecionando...</h1>
      <p className="text-gray-400">Seu pagamento foi processado com sucesso!</p>
    </div>
  );
};

export default AccountRedirect; 