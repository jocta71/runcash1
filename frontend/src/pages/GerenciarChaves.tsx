import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, RefreshCw, Info, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AccessKey {
  id: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
}

const GerenciarChaves: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [accessKey, setAccessKey] = useState<AccessKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isLocalMode, setIsLocalMode] = useState(false);
  
  const { user } = useAuth();

  // Gerar uma chave localmente e salvá-la no localStorage
  const generateLocalKey = () => {
    // Função para gerar uma string aleatória
    const generateRandomString = (length: number) => {
      const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    };
    
    // Gerar ID e chave
    const newId = 'local_' + Date.now();
    const newKey = generateRandomString(64);
    const now = new Date().toISOString();
    
    const keyData: AccessKey = {
      id: newId,
      key: newKey,
      createdAt: now,
      lastUsed: null
    };
    
    // Salvar no localStorage
    localStorage.setItem('runcash_access_key', JSON.stringify(keyData));
    
    return keyData;
  };

  useEffect(() => {
    if (user) {
      fetchAccessKey();
    }
  }, [user]);

  const fetchAccessKey = async () => {
    setLoading(true);
    try {
      // Primeiro verificar se há uma chave no localStorage
      const localKeyData = localStorage.getItem('runcash_access_key');
      if (localKeyData) {
        const parsedKey = JSON.parse(localKeyData);
        setAccessKey(parsedKey);
        setIsLocalMode(true);
        setLoading(false);
        return;
      }
      
      // Tentar buscar do servidor
      const response = await axios.get('/api/subscription/access-key');
      setAccessKey(response.data);
      setIsLocalMode(false);
    } catch (error) {
      console.error('Erro ao buscar chave de acesso:', error);
      
      // Se o erro for 404, gerar uma chave local
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('Endpoint não disponível, usando modo local');
        const localKey = generateLocalKey();
        setAccessKey(localKey);
        setIsLocalMode(true);
        
        toast({
          title: 'Modo local ativado',
          description: 'O servidor de chaves não está disponível. Uma chave local foi gerada.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'Erro',
          description: 'Não foi possível buscar sua chave de acesso.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const regenerateKey = async () => {
    if (window.confirm('Tem certeza que deseja regenerar sua chave de acesso? A chave atual será invalidada e todas as integrações existentes precisarão ser atualizadas.')) {
      setRegenerating(true);
      try {
        if (isLocalMode) {
          // Regenerar localmente
          const localKey = generateLocalKey();
          setAccessKey(localKey);
          
          toast({
            title: 'Chave regenerada',
            description: 'Sua nova chave de acesso local foi gerada com sucesso.',
          });
        } else {
          // Regenerar no servidor
          const response = await axios.post('/api/subscription/regenerate-key');
          setAccessKey(response.data);
        }
        
        setShowKey(true);
        if (!isLocalMode) {
          toast({
            title: 'Chave regenerada',
            description: 'Sua nova chave de acesso foi gerada com sucesso.',
          });
        }
      } catch (error) {
        console.error('Erro ao regenerar chave:', error);
        
        // Se o erro for 404, mudar para modo local
        if (axios.isAxiosError(error) && error.response?.status === 404) {
          const localKey = generateLocalKey();
          setAccessKey(localKey);
          setIsLocalMode(true);
          
          toast({
            title: 'Modo local ativado',
            description: 'O servidor de chaves não está disponível. Uma chave local foi gerada.',
            variant: 'default',
          });
        } else {
          toast({
            title: 'Erro',
            description: 'Não foi possível regenerar sua chave de acesso.',
            variant: 'destructive',
          });
        }
      } finally {
        setRegenerating(false);
      }
    }
  };

  const handleCopyKey = () => {
    if (accessKey) {
      navigator.clipboard.writeText(accessKey.key);
      setCopied(true);
      toast({
        title: 'Copiado!',
        description: 'Chave de acesso copiada para a área de transferência.',
      });
      
      setTimeout(() => {
        setCopied(false);
      }, 3000);
    }
  };

  const toggleShowKey = () => {
    setShowKey(!showKey);
  };

  const formatLastUsed = (date: string | null) => {
    if (!date) return 'Nunca utilizada';
    
    return `${formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true })}`;
  };

  return (
    <div className="gerenciar-chaves-container max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">
        Gerenciar Chaves de API
      </h1>
      
      <p className="mb-6 text-muted-foreground">
        Sua chave de API permite acesso aos dados criptografados das roletas. 
        Mantenha sua chave em segurança e não a compartilhe com terceiros.
      </p>
      
      {isLocalMode && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Modo de Chave Local</AlertTitle>
          <AlertDescription>
            O servidor de chaves não está disponível. Usando uma chave armazenada localmente que funcionará apenas neste dispositivo.
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Sua Chave de Acesso</CardTitle>
            <Tooltip>
              <Info className="h-5 w-5 text-blue-500" />
              <span>Esta chave permite o acesso aos dados criptografados do RunCash</span>
            </Tooltip>
          </div>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6">
          {loading ? (
            <p>Carregando sua chave de acesso...</p>
          ) : accessKey ? (
            <div>
              <div className="flex mb-4 relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={accessKey.key}
                  readOnly
                  className="font-mono pr-24"
                />
                <Button 
                  variant="outline" 
                  size="sm"
                  className="absolute right-0 top-0 h-full"
                  onClick={toggleShowKey}
                >
                  {showKey ? "Ocultar" : "Mostrar"}
                </Button>
              </div>
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">ID:</span>
                  <span className="font-mono">{accessKey.id}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-medium">Criada em:</span>
                  <span>{new Date(accessKey.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="font-medium">Último uso:</span>
                  <span>{formatLastUsed(accessKey.lastUsed)}</span>
                </div>
                
                {isLocalMode && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="font-medium text-amber-500">Tipo:</span>
                    <span className="text-amber-500">Chave Local</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p>Nenhuma chave de acesso encontrada. Clique em "Gerar Nova Chave" abaixo.</p>
          )}
        </CardContent>
        
        <CardFooter>
          <div className="flex gap-4 flex-wrap">
            <Button
              variant="outline"
              className="flex items-center gap-2"
              onClick={handleCopyKey}
              disabled={!accessKey || loading}
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copiado!" : "Copiar Chave"}
            </Button>
            
            <Button
              variant="destructive"
              className="flex items-center gap-2"
              onClick={regenerateKey}
              disabled={loading}
            >
              {regenerating ? (
                <span>Gerando...</span>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Gerar Nova Chave
                </>
              )}
            </Button>
          </div>
        </CardFooter>
      </Card>
        
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informações Importantes</CardTitle>
        </CardHeader>
        
        <Separator />
        
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 mt-1 text-orange-500" />
              <div>
                <p className="font-bold">Segurança da Chave</p>
                <p className="text-muted-foreground">Nunca compartilhe sua chave de API. Ela é pessoal e está vinculada à sua conta.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 mt-1 text-blue-500" />
              <div>
                <p className="font-bold">Uso da Chave</p>
                <p className="text-muted-foreground">
                  {isLocalMode 
                    ? "Sua chave local será usada automaticamente pelo RunCash neste dispositivo para descriptografar os dados." 
                    : "Sua chave é usada automaticamente pelo RunCash para descriptografar os dados das roletas."}
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 mt-1 text-red-500" />
              <div>
                <p className="font-bold">Regeneração</p>
                <p className="text-muted-foreground">
                  {isLocalMode 
                    ? "Se regenerar sua chave local, a antiga será invalidada e você precisará atualizar a página para aplicar a nova chave." 
                    : "Se regenerar sua chave, a antiga será invalidada imediatamente e você precisará atualizar em todos os dispositivos."}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GerenciarChaves; 