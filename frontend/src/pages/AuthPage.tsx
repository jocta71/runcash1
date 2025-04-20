import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Página convertida para simplesmente redirecionar para a home
const AuthPage = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirecionar para a página inicial
    navigate('/');
  }, [navigate]);
  
  // Tela de carregamento enquanto redireciona
  return (
    <div className="min-h-screen w-full bg-gray-950 flex items-center justify-center">
      <p className="text-white">Redirecionando...</p>
    </div>
  );
};

export default AuthPage;
