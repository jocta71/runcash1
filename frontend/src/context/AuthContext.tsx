import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Cookies from 'js-cookie';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  token: string | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<void>;
  signInWithGitHub: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(Cookies.get('token') || null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Efeito para salvar o token no cookie quando ele muda
  useEffect(() => {
    if (token) {
      Cookies.set('token', token, {
        secure: true,
        sameSite: 'none',
        path: '/',
        expires: 30
      });
    } else {
      Cookies.remove('token');
    }
  }, [token]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Armazenar o token JWT se disponível
      if (data?.session?.access_token) {
        setToken(data.session.access_token);
      }
      
      return { error: null };
    } catch (error) {
      console.error('Error signing in:', error);
      toast({
        title: "Login falhou",
        description: error.message || "Não foi possível fazer login. Verifique suas credenciais.",
        variant: "destructive"
      });
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log("Iniciando login com Google...");
      
      // Marcamos o início do processo de autenticação com Google
      localStorage.setItem('googleAuthInProgress', 'true');
      
      // Certifique-se de que esta URL corresponde exatamente à URL de redirecionamento 
      // configurada no console do Google Cloud
      const redirectTo = `${window.location.origin}/auth`;
      console.log("URL de redirecionamento configurada:", redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          }
        }
      });
      
      if (error) {
        console.error("Erro na autenticação com Google:", error);
        throw error;
      }
      
      if (data?.url) {
        console.log("Redirecionando para:", data.url);
        // Opcional: forçar a navegação para a URL de redirecionamento
        window.location.href = data.url;
      } else {
        console.warn("URL de redirecionamento não disponível");
      }
    } catch (error) {
      console.error('Erro detalhado ao fazer login com Google:', error);
      toast({
        title: "Login com Google falhou",
        description: error.message || "Não foi possível fazer login com Google. Verifique as configurações de OAuth.",
        variant: "destructive"
      });
    }
  };

  const signInWithGitHub = async () => {
    try {
      console.log("Iniciando login com GitHub...");
      
      const redirectTo = `${window.location.origin}/auth`;
      console.log("URL de redirecionamento configurada:", redirectTo);
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: redirectTo
        }
      });
      
      if (error) {
        console.error("Erro na autenticação com GitHub:", error);
        throw error;
      }
      
      if (data?.url) {
        console.log("Redirecionando para:", data.url);
        // Opcional: forçar a navegação para a URL de redirecionamento
        window.location.href = data.url;
      } else {
        console.warn("URL de redirecionamento não disponível");
      }
    } catch (error) {
      console.error('Erro detalhado ao fazer login com GitHub:', error);
      toast({
        title: "Login com GitHub falhou",
        description: error.message || "Não foi possível fazer login com GitHub.",
        variant: "destructive"
      });
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      toast({
        title: "Cadastro realizado",
        description: "Verifique seu email para confirmar a conta.",
      });
      return { error: null };
    } catch (error) {
      console.error('Error signing up:', error);
      toast({
        title: "Cadastro falhou",
        description: error.message || "Não foi possível criar a conta.",
        variant: "destructive"
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      // Limpar o token ao fazer logout
      setToken(null);
      // Limpar qualquer flag de autenticação em progresso
      localStorage.removeItem('googleAuthInProgress');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Erro ao sair",
        description: "Não foi possível encerrar a sessão.",
        variant: "destructive"
      });
    }
  };

  const value = {
    session,
    user,
    loading,
    token,
    setToken,
    setUser,
    signIn,
    signUp,
    signInWithGoogle,
    signInWithGitHub,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
