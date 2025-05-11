import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import axios from 'axios';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, RefreshCw, Info, Lock } from 'lucide-react';
import { RootState } from '@/store/store';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/use-toast";
import SubscriptionRequired from '@/components/SubscriptionRequired';

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
  
  const user = useSelector((state: RootState) => state.auth.user);
  const isSubscribed = user?.subscription?.isActive || false;
  
  useEffect(() => {
    if (isSubscribed) {
      fetchAccessKey();
    }
  }, [isSubscribed]);

  const fetchAccessKey = async () => {
    setLoading(true);
    try {
      const response = await axios.get('/api/subscription/access-key');
      setAccessKey(response.data);
    } catch (error) {
      console.error('Erro ao buscar chave de acesso:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível buscar sua chave de acesso.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const regenerateKey = async () => {
    setRegenerating(true);
    try {
      const response = await axios.post('/api/subscription/regenerate-key');
      setAccessKey(response.data);
      setShowKey(true);
      toast({
        title: 'Chave regenerada',
        description: 'Sua nova chave de acesso foi gerada com sucesso.',
      });
    } catch (error) {
      console.error('Erro ao regenerar chave:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível regenerar sua chave de acesso.',
        variant: 'destructive',
      });
    } finally {
      setRegenerating(false);
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

  if (!isSubscribed) {
    return <SubscriptionRequired />;
  }

  return (
    <div className="gerenciar-chaves-container max-w-4xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">
        Gerenciar Chaves de API
      </h1>
      
      <p className="mb-6 text-muted-foreground">
        Sua chave de API permite acesso aos dados criptografados das roletas. 
        Mantenha sua chave em segurança e não a compartilhe com terceiros.
      </p>
      
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Sua Chave de Acesso</CardTitle>
            <Tooltip delayDuration={300}>
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
                <p className="text-muted-foreground">Nunca compartilhe sua chave de API. Ela é pessoal e está vinculada à sua assinatura.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 mt-1 text-blue-500" />
              <div>
                <p className="font-bold">Uso da Chave</p>
                <p className="text-muted-foreground">Sua chave é usada automaticamente pelo RunCash para descriptografar os dados das roletas.</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <RefreshCw className="h-5 w-5 mt-1 text-red-500" />
              <div>
                <p className="font-bold">Regeneração</p>
                <p className="text-muted-foreground">Se regenerar sua chave, a antiga será invalidada imediatamente e você precisará atualizar em todos os dispositivos.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GerenciarChaves; 