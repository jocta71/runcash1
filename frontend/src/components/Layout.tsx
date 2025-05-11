import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import ChatUI from './ChatUI';
import AIFloatingBar from './AIFloatingBar';
import { LogOut, Menu, MessageSquare, LogIn, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import UnifiedRouletteClient from '../services/UnifiedRouletteClient';
import { useAuth } from '@/context/AuthContext';
import { Button } from './ui/button';
import ProfileDropdown from './ProfileDropdown';
import AnimatedInsights from './AnimatedInsights';
import Footer from './Footer';
import GlowingCubeLoader from './GlowingCubeLoader';
import { useLoginModal } from '@/context/LoginModalContext';

// Interface estendida para o usuário com firstName e lastName
interface ExtendedUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  firstName?: string;
  lastName?: string;
}

interface LayoutProps {
  children: React.ReactNode;
  preloadData?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, preloadData = false }) => {
  const { user, signOut } = useAuth();
  const { showLoginModal, resetModalClosed } = useLoginModal();
  const [isLoading, setIsLoading] = useState(preloadData);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // Cast para o tipo estendido para acessar firstName e lastName
  const extUser = user as unknown as ExtendedUser;
  
  // Função para obter o nome de exibição (nome completo ou username como fallback)
  const getDisplayName = () => {
    if (extUser?.firstName || extUser?.lastName) {
      return `${extUser.firstName || ''} ${extUser.lastName || ''}`.trim();
    }
    return extUser?.username || 'Usuário';
  };

  // Pré-carregar dados das roletas se preloadData for verdadeiro
  useEffect(() => {
    if (!preloadData) {
      setIsLoading(false);
      return;
    }

    // Se preloadData é true, queremos garantir que o UnifiedRouletteClient esteja ativo
    // e esperar pelos primeiros dados antes de remover o loader.
    const client = UnifiedRouletteClient.getInstance();
    
    console.log('[Layout] Lógica de pré-carregamento ativada. UnifiedRouletteClient deve ser inicializado centralmente.');

    // Função para verificar dados e atualizar o estado de carregamento
    const checkInitialDataAndSetLoading = () => {
      const currentData = client.getAllRoulettes();
      if (currentData.length > 0) {
        console.log(`[Layout] Dados encontrados no UnifiedRouletteClient (${currentData.length} roletas). Removendo loader.`);
        setIsLoading(false);
        return true; // Dados encontrados
      }
      // Se não encontrou, mas o cliente não está nem conectando/conectado ao stream, não adianta esperar por 'update' ainda.
      // A inicialização central deve tratar disso. Por segurança, manter isLoading true.
      const status = client.getStatus();
      if (!status.isStreamConnected && !status.isStreamConnecting) {
        console.log('[Layout] UnifiedRouletteClient não está conectado/conectando ao stream. Tentando forçar update/conexão.');
        client.forceUpdate().catch(err => {
            console.warn('[Layout] Chamada a forceUpdate no UnifiedRouletteClient durante o preload falhou (não crítico aqui):', err);
        });
      }
      return false; // Sem dados ainda
    };

    // Verificar imediatamente
    if (checkInitialDataAndSetLoading()) {
      return; // Dados já disponíveis ou erro, loader removido ou erro exibido
    }
    
    // Se não há dados, continuar mostrando isLoading (que já está true)
    // e ouvir o primeiro evento 'update' ou 'initialHistoryLoaded' com dados.
    const handleDataReceived = (eventData: any) => {
      let roulettes = [];
      if (eventData?.roulettes && Array.isArray(eventData.roulettes)) {
        roulettes = eventData.roulettes;
      } else if (Array.isArray(eventData)) { // Caso o evento 'update' envie o array diretamente
        roulettes = eventData;
      } else if (eventData instanceof Map && eventData.size > 0) { // Caso de 'initialHistoryLoaded'
         // Se initialHistoryLoaded emite um Map, precisamos convertê-lo ou verificar se o 'update' subsequente trará a lista.
         // Por ora, vamos considerar que o 'update' é o principal para a lista completa.
         // Se for necessário, pode-se chamar client.getAllRoulettes() aqui após o 'initialHistoryLoaded'.
         // Vamos simplificar e focar no 'update' para a lista principal de roletas.
         // Se o 'initialHistoryLoaded' já popula o rouletteData e dispara 'update', está coberto.
         // Se não, uma lógica mais específica seria necessária aqui para o initialHistoryLoaded.
         // Revisitando: client.getAllRoulettes() após o evento initialHistoryLoaded se este não popular client.rouletteData
         const allData = client.getAllRoulettes();
         if (allData.length > 0) roulettes = allData;
      }


      if (roulettes.length > 0) {
        console.log('[Layout] Evento com dados recebido do UnifiedRouletteClient. Removendo loader.');
        setIsLoading(false);
        // Cancelar inscrições após o primeiro recebimento de dados
        client.unsubscribe('update', handleDataReceived);
        client.unsubscribe('initialHistoryLoaded', handleDataReceived);
      }
    };

    client.subscribe('update', handleDataReceived);
    client.subscribe('initialHistoryLoaded', handleDataReceived); // Ouvir também o histórico inicial

    // Timeout de segurança para remover o loader caso algo dê muito errado e nenhum evento chegue.
    // Evita que o usuário fique preso na tela de carregamento indefinidamente.
    const safetyTimeout = setTimeout(() => {
      if (isLoading) { // Verifica se isLoading ainda é true
        console.warn('[Layout] Timeout de segurança atingido para pré-carregamento de dados. Removendo loader.');
        setIsLoading(false);
        client.unsubscribe('update', handleDataReceived);
        client.unsubscribe('initialHistoryLoaded', handleDataReceived);
      }
    }, 15000); // 15 segundos de timeout

    // Cleanup: cancelar inscrições e timeout se o componente for desmontado
    return () => {
      clearTimeout(safetyTimeout);
      client.unsubscribe('update', handleDataReceived);
      client.unsubscribe('initialHistoryLoaded', handleDataReceived);
    };

  }, [preloadData, isLoading]); // Adicionado isLoading para reavaliar o timeout de segurança se ele mudar externamente.

  const handleLoginClick = () => {
    resetModalClosed();
    showLoginModal();
  };

  // Renderizar tela de carregamento se estiver carregando
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#100f13] flex flex-col items-center justify-center text-white">
        <GlowingCubeLoader />
      </div>
    );
  }

  // Renderizar tela de erro
  if (error) {
    return (
      <div className="min-h-screen bg-[#100f13] flex flex-col items-center justify-center text-white">
        <div className="bg-red-900/30 p-6 rounded-lg max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Erro ao carregar dados</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-md"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    if (signOut) {
      await signOut();
      window.location.href = '/';
    }
  };

  // Componente para exibir ações de usuário autenticado
  const AuthenticatedActions = () => (
    <>
      {/* Informações do usuário */}
      <div className="hidden lg:flex items-center bg-[#1A191F]/70 rounded-full px-3 py-1 text-white">
        <span className="text-xs font-medium">Olá, {getDisplayName()}</span>
      </div>
      
      <ProfileDropdown />
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSignOut}
        className="h-8 text-red-500 border-red-500 hover:bg-red-500/10"
      >
        <LogOut size={14} className="mr-1" /> Sair
      </Button>
    </>
  );

  // Componente para exibir ações de usuário não autenticado
  const UnauthenticatedActions = () => (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleLoginClick}
        className="h-8 text-white border-white/20 hover:bg-white/10"
      >
        <UserPlus size={14} className="mr-1" /> Registrar
      </Button>
      
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleLoginClick}
        className="h-8 text-black bg-vegas-green hover:bg-vegas-green/90"
      >
        <LogIn size={14} className="mr-1" /> Entrar
      </Button>
    </>
  );

  // Componente para exibir ações de usuário autenticado em mobile
  const MobileAuthenticatedActions = () => (
    <div className="flex items-center gap-2">
      {user && (
        <div className="flex items-center bg-[#1A191F]/70 rounded-full px-3 py-1 text-white mr-2">
          <span className="text-xs font-medium">Olá, {getDisplayName()}</span>
        </div>
      )}
      <ProfileDropdown />
      
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleSignOut}
        className="h-8 text-red-500 border-red-500 hover:bg-red-500/10"
      >
        <LogOut size={14} className="mr-1" /> Sair
      </Button>
    </div>
  );

  // Componente para exibir ações de usuário não autenticado em mobile
  const MobileUnauthenticatedActions = () => (
    <div className="flex items-center gap-2">
      <Button 
        variant="outline" 
        size="sm" 
        onClick={handleLoginClick}
        className="h-8 text-white border-white/20 hover:bg-white/10"
      >
        <UserPlus size={14} /> 
      </Button>
      
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleLoginClick}
        className="h-8 text-black bg-vegas-green hover:bg-vegas-green/90"
      >
        <LogIn size={14} /> 
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-vegas-black">
      {/* Desktop Sidebar */}
      <div className="hidden md:block w-64 min-h-screen fixed left-0 top-0 z-30 overflow-y-auto">
        <Sidebar />
      </div>
      
      {/* Mobile Sidebar (drawer) */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} isMobile={true} />
      
      <div className="flex-1 relative">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-[#131614]">
          <button 
            className="p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} className="bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent" />
          </button>
          
          <button 
            className="p-2"
            onClick={() => setChatOpen(true)}
          >
            <MessageSquare size={24} className="bg-gradient-to-r from-[#00FF00] to-[#A3FFA3] bg-clip-text text-transparent" />
          </button>
        </div>
        
        {/* Desktop Header */}
        <div className="hidden md:flex fixed top-0 left-0 right-0 md:left-64 z-40 h-[70px] items-center justify-between px-4 border-b border-border bg-[#131614]">
          <div className="flex items-center gap-2">
            {/* Logo e caixa de pesquisa removidos conforme solicitado */}
          </div>
          
          <AnimatedInsights />
          
          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" asChild className="h-8 text-white font-medium bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900">
              <Link to="/planos">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Planos
              </Link>
            </Button>
            
            {/* Ações de usuário com base no estado de autenticação */}
            {user ? <AuthenticatedActions /> : <UnauthenticatedActions />}
          </div>
        </div>
        
        {/* Mobile User Info */}
        <div className="md:hidden flex justify-between items-center px-4 py-3">
          {/* Ações de usuário com base no estado de autenticação */}
          {user ? <MobileAuthenticatedActions /> : <MobileUnauthenticatedActions />}
          
          <Button variant="default" size="sm" asChild className="h-8 text-white font-medium bg-gradient-to-b from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900">
            <Link to="/planos">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg> Planos
            </Link>
          </Button>
        </div>
        
        {/* Mobile Insights */}
        <div className="md:hidden px-4 py-2">
          <div className="bg-[#1A191F]/50 rounded-lg p-3">
            <AnimatedInsights />
          </div>
        </div>
        
        {/* Área do conteúdo principal */}
        <main className="pt-4 md:pt-[70px] pb-8 px-4 md:px-6 md:pl-[280px] w-full min-h-screen bg-[#131614]">
          {children}
        </main>

        {/* Footer - com classe para evitar sobreposição com o chat */}
        <div className="md:pl-64 lg:pl-64 md:pr-[400px] lg:pr-[400px] pb-[100px] md:pb-0">
          <Footer />
        </div>
      </div>
      
      {/* Chat fixo na parte inferior */}
      <div className="fixed bottom-0 right-0 w-[400px] h-[600px] z-40">
        <ChatUI isOpen={true} />
      </div>
      
      {/* Mobile Chat (drawer) */}
      <ChatUI isOpen={chatOpen} onClose={() => setChatOpen(false)} isMobile={true} />
      
      {/* Barra flutuante da IA */}
      <AIFloatingBar />
    </div>
  );
};

export default Layout; 