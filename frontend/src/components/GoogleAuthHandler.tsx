import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

const GoogleAuthHandler = () => {
  const { setUser, setToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // API URL
  const API_URL = import.meta.env.VITE_API_URL || 'https://runcashh11.vercel.app/api';

  useEffect(() => {
    // Verificar token na URL (para login com Google)
    const queryParams = new URLSearchParams(location.search);
    const tokenFromUrl = queryParams.get('token');
    
    if (tokenFromUrl) {
      // Limpar a URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Armazenar o token e processar o login
      localStorage.setItem('token', tokenFromUrl);
      setToken(tokenFromUrl);
      
      // Buscar informações do usuário
      axios.get(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${tokenFromUrl}`
        }
      })
      .then(response => {
        if (response.data.success && response.data.data) {
          setUser(response.data.data);
          navigate('/');
        }
      })
      .catch(error => {
        console.error('Erro ao obter dados do usuário:', error);
        navigate('/login');
      });
    }
  }, [location, navigate, setToken, setUser, API_URL]);

  return null; // Este componente não renderiza nada visualmente
};

export default GoogleAuthHandler; 