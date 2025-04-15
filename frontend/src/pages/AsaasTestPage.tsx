import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createAsaasCustomer, createAsaasSubscription } from '@/integrations/asaas/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

// Planos de teste
const testPlans = [
  { id: 'plan_test_basic', name: 'Plano Básico (Teste)', price: 19.90, interval: 'monthly' },
  { id: 'plan_test_pro', name: 'Plano Profissional (Teste)', price: 49.90, interval: 'monthly' },
  { id: 'plan_test_premium', name: 'Plano Premium (Teste)', price: 99.90, interval: 'monthly' },
];

const AsaasTestPage = () => {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState('create_customer');
  const [selectedPlan, setSelectedPlan] = useState(testPlans[0].id);
  const [customerId, setCustomerId] = useState('');
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  const [redirectUrl, setRedirectUrl] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Limpa mensagens anteriores
    if (error) setError(null);
    if (success) setSuccess(null);
    
    const { name, value } = e.target;
    
    if (name === 'cpf') {
      setFormData(prev => ({ ...prev, [name]: formatCPF(value) }));
    } else if (name === 'phone') {
      setFormData(prev => ({ ...prev, [name]: formatPhone(value) }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const createCustomer = async () => {
    setError(null);
    setSuccess(null);
    setApiResponse(null);
    
    if (!formData.name || !formData.email || !formData.cpf) {
      setError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    
    // Validação de CPF
    const cpfClean = formData.cpf.replace(/\D/g, '');
    if (cpfClean.length !== 11) {
      setError("Por favor, insira um CPF válido com 11 dígitos.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log('Iniciando criação de cliente no Asaas...');
      const customerIdResult = await createAsaasCustomer({
        name: formData.name,
        email: formData.email,
        cpfCnpj: cpfClean,
        mobilePhone: formData.phone.replace(/\D/g, '')
      });
      
      setCustomerId(customerIdResult);
      setSuccess(`Cliente criado com sucesso! ID: ${customerIdResult}`);
      toast({
        title: "Cliente criado!",
        description: `O cliente foi criado com sucesso no Asaas. ID: ${customerIdResult}`,
      });
      
      // Auto-mudar para a aba de assinatura
      setSelectedTab('create_subscription');
      
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      
      if (error instanceof Error) {
        setError(`Falha ao criar cliente: ${error.message}`);
      } else {
        setError('Ocorreu um erro ao criar o cliente.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  const createSubscription = async () => {
    setError(null);
    setSuccess(null);
    setApiResponse(null);
    setRedirectUrl('');
    
    if (!customerId) {
      setError("ID do cliente é obrigatório.");
      return;
    }
    
    if (!userId) {
      setError("ID do usuário é obrigatório.");
      return;
    }
    
    if (!selectedPlan) {
      setError("Selecione um plano.");
      return;
    }
    
    setIsLoading(true);
    
    try {
      console.log(`Criando assinatura: planId=${selectedPlan}, userId=${userId}, customerId=${customerId}`);
      
      const result = await createAsaasSubscription(
        selectedPlan,
        userId,
        customerId
      );
      
      setApiResponse(result);
      setRedirectUrl(result.redirectUrl);
      setSuccess(`Assinatura criada com sucesso! URL de pagamento gerada.`);
      
      toast({
        title: "Assinatura criada!",
        description: `Assinatura criada com sucesso. ID: ${result.subscriptionId}`,
      });
      
    } catch (error) {
      console.error('Erro ao criar assinatura:', error);
      
      if (error instanceof Error) {
        setError(`Falha ao criar assinatura: ${error.message}`);
      } else {
        setError('Ocorreu um erro ao criar a assinatura.');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Teste de Integração Asaas</CardTitle>
          <CardDescription>
            Use esta página para testar a integração com o Asaas, criando clientes e assinaturas
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="w-full mb-6">
          <TabsTrigger value="create_customer" className="flex-1">1. Criar Cliente</TabsTrigger>
          <TabsTrigger value="create_subscription" className="flex-1">2. Criar Assinatura</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create_customer">
          <Card>
            <CardHeader>
              <CardTitle>Criar Cliente no Asaas</CardTitle>
              <CardDescription>
                Preencha os dados para criar um novo cliente ou recuperar um existente
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="mb-4 bg-green-700/20 border-green-700">
                  <AlertTitle>Sucesso</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Nome completo *
                  </label>
                  <Input
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    E-mail *
                  </label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Ex: joao@exemplo.com"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="cpf" className="block text-sm font-medium mb-1">
                    CPF *
                  </label>
                  <Input
                    id="cpf"
                    name="cpf"
                    value={formData.cpf}
                    onChange={handleChange}
                    placeholder="Ex: 123.456.789-10"
                    maxLength={14}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium mb-1">
                    Telefone *
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Ex: (11) 98765-4321"
                    maxLength={15}
                    required
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                onClick={createCustomer}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Criar Cliente'
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="create_subscription">
          <Card>
            <CardHeader>
              <CardTitle>Criar Assinatura</CardTitle>
              <CardDescription>
                Use esta seção para criar uma assinatura para um cliente existente
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {success && (
                <Alert className="mb-4 bg-green-700/20 border-green-700">
                  <AlertTitle>Sucesso</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="customerId" className="block text-sm font-medium mb-1">
                    ID do Cliente *
                  </label>
                  <Input
                    id="customerId"
                    value={customerId}
                    onChange={(e) => {
                      setCustomerId(e.target.value);
                      if (error) setError(null);
                      if (success) setSuccess(null);
                    }}
                    placeholder="cus_xxx"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="userId" className="block text-sm font-medium mb-1">
                    ID do Usuário *
                  </label>
                  <Input
                    id="userId"
                    value={userId}
                    onChange={(e) => {
                      setUserId(e.target.value);
                      if (error) setError(null);
                      if (success) setSuccess(null);
                    }}
                    placeholder="ID do usuário no seu sistema"
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="planSelect" className="block text-sm font-medium mb-1">
                    Plano *
                  </label>
                  <Select
                    value={selectedPlan}
                    onValueChange={(value) => {
                      setSelectedPlan(value);
                      if (error) setError(null);
                      if (success) setSuccess(null);
                    }}
                  >
                    <SelectTrigger id="planSelect">
                      <SelectValue placeholder="Selecione um plano" />
                    </SelectTrigger>
                    <SelectContent>
                      {testPlans.map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name} - R$ {plan.price.toFixed(2)}/{plan.interval === 'monthly' ? 'mês' : 'ano'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {redirectUrl && (
                  <div className="mt-4 p-4 bg-slate-800 rounded-md">
                    <p className="text-sm font-medium mb-2">URL de Pagamento:</p>
                    <div className="flex flex-col gap-2">
                      <code className="text-xs bg-slate-900 p-2 rounded overflow-x-auto">
                        {redirectUrl}
                      </code>
                      <Button 
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(redirectUrl, '_blank')}
                      >
                        Abrir URL de Pagamento
                      </Button>
                    </div>
                  </div>
                )}
                
                {apiResponse && (
                  <div className="mt-4 p-4 bg-slate-800 rounded-md">
                    <p className="text-sm font-medium mb-2">Resposta da API:</p>
                    <pre className="text-xs bg-slate-900 p-2 rounded overflow-x-auto">
                      {JSON.stringify(apiResponse, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter>
              <Button 
                onClick={createSubscription}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  'Criar Assinatura'
                )}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AsaasTestPage; 