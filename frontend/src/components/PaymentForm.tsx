import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { createAsaasCustomer, createAsaasSubscription } from '@/integrations/asaas/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { CreditCard, QrCode } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import axios from 'axios';
import PixPayment from './PixPayment';
import API_ROUTES from '@/config/api';

// Função para formatar CPF
const formatCPF = (value: string) => {
  // Remove todos os caracteres não numéricos
  const cleanValue = value.replace(/\D/g, '');
  
  // Aplica a máscara do CPF: XXX.XXX.XXX-XX
  if (cleanValue.length <= 3) {
    return cleanValue;
  } else if (cleanValue.length <= 6) {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3)}`;
  } else if (cleanValue.length <= 9) {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6)}`;
  } else {
    return `${cleanValue.slice(0, 3)}.${cleanValue.slice(3, 6)}.${cleanValue.slice(6, 9)}-${cleanValue.slice(9, 11)}`;
  }
};

// Função para formatar telefone
const formatPhone = (value: string) => {
  // Remove todos os caracteres não numéricos
  const cleanValue = value.replace(/\D/g, '');
  
  if (cleanValue.length <= 2) {
    return cleanValue;
  } else if (cleanValue.length <= 7) {
    return `(${cleanValue.slice(0, 2)}) ${cleanValue.slice(2)}`;
  } else {
    return `(${cleanValue.slice(0, 2)}) ${cleanValue.slice(2, 7)}-${cleanValue.slice(7, 11)}`;
  }
};

interface PaymentFormProps {
  planId: string;
  onPaymentSuccess: () => void;
  onCancel: () => void;
}

interface SubscriptionResponse {
  subscriptionId: string;
  paymentId?: string;
  redirectUrl?: string;
  status: string;
}

export function PaymentForm({ planId, onPaymentSuccess, onCancel }: PaymentFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: user?.username || '',
    email: user?.email || '',
    cpf: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit-card'>('pix');
  const [subscriptionData, setSubscriptionData] = useState<any>(null);

  // Atualizar dados do formulário quando o usuário mudar
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.username || prev.name,
        email: user.email || prev.email
      }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limpa qualquer erro anterior quando o usuário começa a editar o formulário
    if (error) setError(null);
    
    const { name, value } = e.target;
    
    if (name === 'cpf') {
      setFormData(prev => ({ ...prev, [name]: formatCPF(value) }));
    } else if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!user) {
      setError("Você precisa estar logado para assinar um plano.");
      return;
    }
    
    if (!formData.name || !formData.email || !formData.cpf) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    
    // Validação simples de CPF (remover formatação e verificar tamanho)
    const cpfClean = formData.cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      setError("Por favor, insira um CPF válido com 11 dígitos.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Iniciando criação de cliente no Asaas...');
      // Passo 1: Criar ou recuperar cliente no Asaas
      const customerId = await createAsaasCustomer({
        name: formData.name,
        email: formData.email,
        cpfCnpj: cpfClean,
        mobilePhone: formData.phone.replace(/\D/g, ''),
        userId: user.id
      });
      
      console.log('Cliente criado/recuperado com ID:', customerId);
      
      // Passo 2: Criar assinatura
      console.log('Criando assinatura para o cliente...');
      const subscription = await createAsaasSubscription(
        planId, 
        user.id,
        customerId,
        'PIX'
      );
      
      console.log('Assinatura criada:', subscription);
      
      // Se for plano gratuito ou assinatura já ativa, concluir diretamente
      if (planId === 'free' || subscription.status === 'ACTIVE') {
        toast({
          title: "Plano ativado com sucesso!",
          description: "Seu plano foi ativado com sucesso.",
        });
        onPaymentSuccess();
      } else if (subscription.paymentId) {
        // Se tiver paymentId, redirecionar para página de pagamento PIX
        window.location.href = `/payment?planId=${planId}&customerId=${customerId}&paymentId=${subscription.paymentId}`;
      } else {
        setError("Não foi possível obter as informações de pagamento. Por favor, tente novamente.");
      }
    } catch (error) {
      console.error('Erro no processo de assinatura:', error);
      
      if (error instanceof Error) {
        // Tratar erros específicos
        if (error.message.includes('404')) {
          setError("Serviço de pagamento indisponível no momento. Por favor, tente novamente mais tarde.");
        } else if (error.message.includes('Network Error')) {
          setError("Erro de conexão. Verifique sua internet e tente novamente.");
        } else {
          setError(`Erro ao processar assinatura: ${error.message}`);
        }
      } else {
        setError("Ocorreu um erro inesperado ao processar sua assinatura. Por favor, tente novamente.");
      }
      
      toast({
        variant: "destructive",
        title: "Erro na assinatura",
        description: "Não foi possível processar sua assinatura. Por favor, tente novamente.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubscription = async () => {
    if (!user || !user.id) {
      setError('Você precisa estar autenticado para continuar.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Criar assinatura usando a API no Railway
      const response = await axios.post(API_ROUTES.payment.createSubscription, {
        customerId: user.asaasId || user.id, // Usar o ID do usuário caso asaasId não exista
        planId: planId,
        userId: user.id,
        billingType: paymentMethod === 'pix' ? 'PIX' : 'CREDIT_CARD', 
        description: `Assinatura RunCash - Plano ${planId}`
      });

      if (response.data.success) {
        const { subscriptionId, paymentId, qrCode } = response.data.data;
        
        console.log('Assinatura criada com sucesso:', {
          subscriptionId,
          paymentId,
          hasQrCode: !!qrCode
        });
        
        // Armazenar dados da assinatura
        setSubscriptionData({
          subscriptionId,
          paymentId,
          qrCode
        });
        
        // Se for pagamento PIX e não tiver QR Code, mostrar toast de instruções
        if (paymentMethod === 'pix' && !qrCode) {
          toast({
            title: 'QR Code sendo gerado',
            description: 'Aguarde um momento enquanto o QR Code do PIX é gerado.',
            duration: 5000
          });
        }
      } else {
        setError(response.data.error || 'Erro ao criar assinatura');
      }
    } catch (err: any) {
      console.error('Erro ao criar assinatura:', err);
      setError(err.response?.data?.error || 'Erro ao comunicar com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  // Iniciar processo de assinatura ao carregar o componente
  useEffect(() => {
    handleCreateSubscription();
  }, []);

  // Renderizar campos para cartão de crédito
  const renderCreditCardForm = () => {
    return (
      <div className="space-y-4">
        <p className="text-center text-gray-500 mb-4">
          O pagamento com cartão de crédito será implementado em breve.
        </p>
        <Button variant="default" onClick={() => setPaymentMethod('pix')} className="w-full">
          Usar PIX
        </Button>
      </div>
    );
  };

  // Renderizar mensagem de erro
  const renderError = () => {
    if (!error) return null;
    
    return (
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 flex items-start">
        <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium">Erro ao processar pagamento</p>
          <p>{error}</p>
          <Button variant="outline" onClick={handleCreateSubscription} className="mt-2">
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  };

  if (isLoading && !subscriptionData) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center justify-center p-8">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Preparando seu pagamento...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {renderError()}
      
      <Tabs defaultValue="pix" value={paymentMethod} onValueChange={(v: string) => setPaymentMethod(v as 'pix' | 'credit-card')}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="pix" className="flex items-center">
            <QrCode className="w-4 h-4 mr-2" />
            PIX
          </TabsTrigger>
          <TabsTrigger value="credit-card" className="flex items-center">
            <CreditCard className="w-4 h-4 mr-2" />
            Cartão de Crédito
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="pix" className="mt-0">
          {subscriptionData ? (
            <PixPayment 
              paymentId={subscriptionData.paymentId}
              subscriptionId={subscriptionData.subscriptionId}
              qrCode={subscriptionData.qrCode}
              onPaymentSuccess={onPaymentSuccess}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8">
              <p className="text-gray-600">Configurando pagamento com PIX...</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="credit-card" className="mt-0">
          {renderCreditCardForm()}
        </TabsContent>
      </Tabs>
      
      <div className="mt-6 pt-4 border-t border-gray-200">
        <Button variant="outline" onClick={onCancel} className="w-full">
          Cancelar
        </Button>
      </div>
    </Card>
  );
} 