import { useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { createAsaasCustomer, createAsaasSubscription } from '@/integrations/asaas/client';
import { useAuth } from '@/context/AuthContext';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';

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

const PlansPage = () => {
  const { availablePlans } = useSubscription();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>('basic');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: user?.email || '',
    cpf: '',
    phone: ''
  });

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
    setRedirectUrl(null);
    setSubscriptionId(null);
    
    if (!user) {
      setError("Você precisa estar logado para assinar um plano.");
      toast({
        title: "Login necessário",
        description: "Você precisa estar logado para assinar um plano.",
        variant: "destructive"
      });
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
        mobilePhone: formData.phone.replace(/\D/g, '')
      });
      
      console.log('Cliente criado/recuperado com ID:', customerId);
      
      // Passo 2: Criar assinatura
      console.log('Criando assinatura para o cliente...');
      const result = await createAsaasSubscription(
        selectedPlan, 
        user.id,
        customerId
      );
      
      setSubscriptionId(result.subscriptionId);
      setRedirectUrl(result.redirectUrl);
      
      console.log('Assinatura criada, redirecionando para:', result.redirectUrl);
      toast({
        title: "Assinatura criada com sucesso!",
        description: "Veja o link de pagamento abaixo.",
      });
    } catch (error) {
      console.error('Erro no processo de assinatura:', error);
      
      // Exibir mensagem de erro detalhada
      let errorMessage = "Ocorreu um erro ao processar sua assinatura.";
      
      if (error instanceof Error) {
        setError(`${errorMessage} ${error.message}`);
      } else {
        setError(errorMessage);
      }
      
      toast({
        title: "Erro na assinatura",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Teste de Integração Asaas</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Escolha um plano</CardTitle>
            <CardDescription>Selecione um plano para testar a assinatura</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {availablePlans
                .filter(plan => plan.interval === 'monthly')
                .map(plan => (
                  <div 
                    key={plan.id}
                    className={`p-4 border rounded-lg cursor-pointer ${
                      selectedPlan === plan.id 
                        ? 'border-vegas-gold bg-vegas-gold/10' 
                        : 'border-gray-700 hover:border-gray-500'
                    }`}
                    onClick={() => setSelectedPlan(plan.id)}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-bold">{plan.name}</h3>
                      <span className="font-bold">
                        {plan.price === 0 ? 'Grátis' : `R$ ${plan.price.toFixed(2)}`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Dados para teste</CardTitle>
            <CardDescription>Preencha os dados para criar uma assinatura</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Seu nome completo"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  name="cpf"
                  value={formData.cpf}
                  onChange={handleChange}
                  placeholder="XXX.XXX.XXX-XX"
                  maxLength={14}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="(XX) XXXXX-XXXX"
                  maxLength={15}
                />
              </div>
              
              <Button
                type="submit"
                className="w-full bg-vegas-gold hover:bg-vegas-gold/80 text-black"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Criar Assinatura de Teste'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      
      {redirectUrl && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Assinatura criada com sucesso!</CardTitle>
            <CardDescription>SubscriptionId: {subscriptionId}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-vegas-gold/10 rounded-lg">
              <p className="mb-4">Link de pagamento gerado:</p>
              <a 
                href={redirectUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block w-full p-3 bg-vegas-gold text-black text-center rounded-lg hover:bg-vegas-gold/80 transition-colors"
              >
                Acessar página de pagamento
              </a>
            </div>
            
            <div className="mt-4 p-4 border border-gray-700 rounded-lg">
              <h3 className="font-medium mb-2">URL Completa:</h3>
              <p className="text-xs break-all bg-black p-2 rounded-lg">{redirectUrl}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PlansPage; 