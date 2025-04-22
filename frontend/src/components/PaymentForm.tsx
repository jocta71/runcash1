import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { createAsaasSubscription, updateAsaasCustomer } from '@/integrations/asaas/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export const PaymentForm = ({ planId, onPaymentSuccess, onCancel }: PaymentFormProps) => {
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
    
    if (!user.asaasCustomerId) {
      setError("Não foi possível encontrar seu cadastro no sistema de pagamento. Por favor, contate o suporte.");
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
      // Usar diretamente o ID do cliente Asaas que já está no objeto user
      const customerId = user.asaasCustomerId;
      
      // Primeiro, atualizar os dados do cliente, especialmente o CPF
      console.log('Atualizando dados do cliente com CPF antes de criar assinatura');
      const updateSuccess = await updateAsaasCustomer(customerId, {
        name: formData.name,
        email: formData.email,
        cpfCnpj: cpfClean,
        mobilePhone: formData.phone.replace(/\D/g, '')
      });
      
      if (!updateSuccess) {
        console.warn('Aviso: Não foi possível atualizar dados do cliente, mas continuando com a criação da assinatura');
      }
      
      console.log('Criando assinatura para o cliente ID:', customerId);
      const subscription = await createAsaasSubscription(
        planId, 
        user.id,
        customerId,
        'PIX'
      );
      
      console.log('Assinatura criada:', subscription);
      
      // Se for plano gratuito, concluir diretamente
      if (planId === 'free') {
        toast({
          title: "Plano ativado com sucesso!",
          description: "Seu plano foi ativado com sucesso.",
        });
        onPaymentSuccess();
      } else if (subscription.paymentId) {
        // Para qualquer plano pago, sempre redirecionar para página de pagamento PIX
        window.location.href = `/pagamento?planId=${planId}&customerId=${customerId}&paymentId=${subscription.paymentId}`;
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
  
  return (
    <div className="w-full p-6 mx-auto rounded-lg">
      <h2 className="text-xl font-bold text-white mb-4">Complete seus dados de pagamento</h2>
      <p className="text-gray-400 mb-4">
        O pagamento será processado via PIX através da plataforma Asaas
      </p>
      
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription dangerouslySetInnerHTML={{ __html: error }} />
        </Alert>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
            Nome completo *
          </label>
          <Input
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Seu nome completo"
            className="w-full bg-vegas-black border-gray-700"
            required
          />
        </div>
        
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
            E-mail *
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="seu@email.com"
            className="w-full bg-vegas-black border-gray-700"
            required
          />
        </div>
        
        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-300 mb-1">
            CPF *
          </label>
          <Input
            id="cpf"
            name="cpf"
            value={formData.cpf}
            onChange={handleChange}
            placeholder="XXX.XXX.XXX-XX"
            maxLength={14}
            className="w-full bg-vegas-black border-gray-700"
            required
          />
        </div>
        
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-300 mb-1">
            Telefone
          </label>
          <Input
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="(XX) XXXXX-XXXX"
            maxLength={15}
            className="w-full bg-vegas-black border-gray-700"
          />
        </div>
        
        <div className="flex gap-4 pt-2">
          <Button
            type="button"
            onClick={onCancel}
            variant="outline"
            className="w-full border-gray-700 text-white hover:bg-vegas-black/50"
            disabled={isLoading}
          >
            Cancelar
          </Button>
          
          <Button
            type="submit"
            className="w-full bg-vegas-gold text-black hover:bg-vegas-gold/80"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              'Continuar'
            )}
          </Button>
        </div>
      </form>
      
      <div className="mt-6 text-xs text-gray-400">
        <p>* Campos obrigatórios</p>
        <p className="mt-2">
          Ao continuar, você concorda com os Termos de Serviço e Política de Privacidade.
        </p>
      </div>
    </div>
  );
}; 