import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FiMail, FiLock, FiUser } from 'react-icons/fi';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectAfterLogin?: string;
  message?: string;
  showUpgradeOption?: boolean;
}

const LoginModal: React.FC<LoginModalProps> = ({ 
  isOpen, 
  onClose, 
  redirectAfterLogin = '/',
  message,
  showUpgradeOption = false
}) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);
    
    try {
      if (isLogin) {
        // Processo de login
        const { error } = await signIn(email, password);
        if (error) {
          setErrorMessage(error.message || 'Erro ao fazer login');
        } else {
          onClose();
          // Navegar para a página de redirecionamento após login bem-sucedido
          if (redirectAfterLogin) {
            navigate(redirectAfterLogin);
          }
        }
      } else {
        // Processo de cadastro
        if (!username.trim()) {
          setErrorMessage('Nome de usuário é obrigatório');
          setIsLoading(false);
          return;
        }
        
        const { error } = await signUp(username, email, password);
        if (error) {
          setErrorMessage(error.message || 'Erro ao criar conta');
        } else {
          onClose();
          // Navegar para a página de redirecionamento após cadastro bem-sucedido
          if (redirectAfterLogin) {
            navigate(redirectAfterLogin);
          }
        }
      }
    } catch (err) {
      setErrorMessage('Ocorreu um erro inesperado');
      console.error('Erro na autenticação:', err);
    } finally {
      setIsLoading(false);
    }
  };
  
  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrorMessage('');
  };
  
  const handleUpgrade = () => {
    onClose();
    navigate('/plans');
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-gray-900 text-white border-gray-800">
        <DialogTitle className="text-xl font-bold text-white">
          {showUpgradeOption 
            ? 'Acesso Restrito' 
            : (isLogin ? 'Entrar na sua conta' : 'Criar uma nova conta')}
        </DialogTitle>
        
        <DialogDescription className="text-gray-400">
          {message || (showUpgradeOption 
            ? 'Para acessar este conteúdo, você precisa ter um plano ativo' 
            : (isLogin 
                ? 'Digite suas credenciais para acessar a plataforma' 
                : 'Preencha os campos abaixo para criar sua conta')
          )}
        </DialogDescription>
        
        {showUpgradeOption ? (
          <div className="flex flex-col space-y-4 py-4">
            <p className="text-sm text-gray-300">
              Adquira um plano para ter acesso a todos os recursos e estatísticas das roletas.
            </p>
            
            <div className="flex flex-col space-y-2">
              <Button 
                onClick={handleUpgrade} 
                className="bg-green-600 hover:bg-green-700"
              >
                Ver planos disponíveis
              </Button>
              
              <Button 
                onClick={onClose} 
                className="border-gray-700 bg-transparent hover:bg-gray-800"
              >
                Voltar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <FiUser className="absolute left-3 top-3 text-gray-500" />
                <Input
                  type="text"
                  id="username"
                  placeholder="Nome de usuário"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                  required
                />
              </div>
            )}
            
            <div className="relative">
              <FiMail className="absolute left-3 top-3 text-gray-500" />
              <Input
                type="email"
                id="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                required
              />
            </div>
            
            <div className="relative">
              <FiLock className="absolute left-3 top-3 text-gray-500" />
              <Input
                type="password"
                id="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-700 text-white"
                required
              />
            </div>
            
            {errorMessage && (
              <div className="p-2 text-sm text-red-500 bg-red-950/20 rounded border border-red-900">
                {errorMessage}
              </div>
            )}
            
            <DialogFooter className="flex sm:justify-between flex-col sm:flex-row gap-2">
              <Button
                type="button"
                className="text-blue-400 hover:text-blue-300 bg-transparent"
                onClick={toggleMode}
                disabled={isLoading}
              >
                {isLogin ? 'Criar uma conta' : 'Já tem uma conta? Entrar'}
              </Button>
              
              <Button 
                type="submit"
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading 
                  ? 'Processando...' 
                  : (isLogin ? 'Entrar' : 'Cadastrar')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;