import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { Pencil, User, CreditCard, Bell, Shield, Users, Database, Trash, ExternalLink, CheckCircle, PlusCircle, Package } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import { Textarea } from '@/components/ui/textarea';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSubscription } from '@/context/SubscriptionContext';
import { Switch } from '@/components/ui/switch';

// Estendendo o tipo User para evitar erros de lint
interface ExtendedUser {
  id: string;
  username: string;
  email: string;
  isAdmin: boolean;
  profilePicture?: string;
  googleId?: string;
  createdAt?: string | Date;
  lastLogin?: string | Date;
  firstName?: string;
  lastName?: string;
  displayName?: string; // Nome completo que pode vir do Google
  givenName?: string;   // Primeiro nome que pode vir do Google
  familyName?: string;  // Sobrenome que pode vir do Google
}

const ProfilePage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
  const { currentSubscription, currentPlan } = useSubscription();
  const [autoRenew, setAutoRenew] = useState(true);
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    bio: '',
    country: 'Brasil',
    cityState: 'São Paulo',
    postalCode: '',
    taxId: '',
  });

  // Dados simulados para demonstração
  const billingHistory = [
    { date: '08/07/2023', details: 'Plano Professional, mensal', amount: 'R$ 49,90', invoiceId: 'Fatura 08 Julho 23' },
    { date: '08/06/2023', details: 'Plano Professional, mensal', amount: 'R$ 49,90', invoiceId: 'Fatura 08 Junho 23' },
    { date: '08/05/2023', details: 'Plano Professional, mensal', amount: 'R$ 49,90', invoiceId: 'Fatura 08 Maio 23' },
  ];

  // Dados simulados para métodos de pagamento
  const paymentMethods = [
    { type: 'PIX', lastDigits: '', selected: true },
  ];

  // Verificar se a URL contém um ID de seção específico
  useEffect(() => {
    const path = location.pathname;
    // Se a URL termina com 'billing', defina a tab como 'billing'
    if (path.endsWith('billing')) {
      setActiveTab('billing');
    }
    // Se a URL contém 'planos', defina a tab como 'plans'
    else if (path.includes('planos')) {
      setActiveTab('plans');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      // Cast para o tipo estendido para acessar as propriedades adicionais
      const extUser = user as unknown as ExtendedUser;
      
      // Tentar obter nome/sobrenome
      let firstName = '';
      let lastName = '';
      
      if (extUser.firstName && extUser.lastName) {
        firstName = extUser.firstName;
        lastName = extUser.lastName;
      } 
      else if (extUser.givenName && extUser.familyName) {
        firstName = extUser.givenName;
        lastName = extUser.familyName;
      }
      else if (extUser.displayName) {
        const nameParts = extUser.displayName.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }
      else if (extUser.username) {
        const nameParts = extUser.username.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      }
      
      setAvatar(extUser.profilePicture || null);
      
      setProfileData({
        firstName,
        lastName,
        email: extUser.email || '',
        phone: '',
        bio: 'Usuário',
        country: 'Brasil',
        cityState: 'São Paulo, SP',
        postalCode: '',
        taxId: '',
      });
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleUpdateProfile = () => {
    toast({
      title: "Perfil atualizado",
      description: "Suas informações de perfil foram salvas com sucesso.",
      variant: "default"
    });
    
    // Aqui você implementaria a lógica para salvar os dados no backend
    console.log('Dados a serem salvos:', profileData);
  };

  const handleViewPlans = () => {
    navigate('/planos');
  };

  const menuItems = [
    { id: 'profile', label: 'Meu Perfil', icon: <User size={18} /> },
    { id: 'billing', label: 'Faturamento', icon: <CreditCard size={18} /> },
    { id: 'plans', label: 'Planos', icon: <Package size={18} /> },
    { id: 'delete-account', label: 'Excluir Conta', icon: <Trash size={18} className="text-red-500" /> },
  ];

  // Renderiza o conteúdo com base na tab ativa
  const renderTabContent = () => {
    switch(activeTab) {
      case 'plans':
        // Redirecionar para a página de planos
        navigate('/planos');
        return null;
      case 'billing':
        return (
          <div className="space-y-8 p-6">
            {/* Planos */}
            <div>
              <h2 className="text-xl font-bold mb-4">Plano</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Plano Básico */}
                <div className={`border rounded-lg p-4 ${currentPlan?.name === 'Básico' ? 'border-vegas-green' : 'border-border'}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Básico</h3>
                    <p className="font-bold">R$ 29,90<span className="text-sm font-normal text-gray-400">/mês</span></p>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">30 dias restantes</p>
                  {currentPlan?.name === 'Básico' ? (
                    <Button 
                      variant="outline" 
                      className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                    >
                      Cancelar Assinatura
                    </Button>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full border-border text-white hover:bg-vegas-black/60"
                    >
                      Escolher
                    </Button>
                  )}
                </div>
                
                {/* Plano Professional */}
                <div className={`border rounded-lg p-4 relative bg-indigo-900/40 ${currentPlan?.name === 'Professional' ? 'border-vegas-green' : 'border-indigo-500/50'}`}>
                  {currentPlan?.name === 'Professional' && (
                    <div className="absolute -top-2 -left-2 bg-vegas-green rounded-full p-1">
                      <CheckCircle className="h-5 w-5 text-black" />
                    </div>
                  )}
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold">Professional</h3>
                    <p className="font-bold">R$ 49,90<span className="text-sm font-normal text-gray-400">/mês</span></p>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">365 dias</p>
                  <div className="flex gap-2">
                    {currentPlan?.name === 'Professional' ? (
                      <Button 
                        variant="outline" 
                        className="w-full border-red-500 text-red-500 hover:bg-red-500/10"
                      >
                        Cancelar Assinatura
                      </Button>
                    ) : (
                      <Button 
                        className="bg-vegas-green text-black hover:bg-vegas-green/90 flex-1"
                      >
                        Upgrade
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="border-border text-white hover:bg-vegas-black/60"
                      onClick={handleViewPlans}
                    >
                      Saiba mais
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Auto Renew Toggle */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Renovação automática</h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Esta opção, se marcada, renovará sua assinatura quando o plano atual expirar.
                    Isso pode evitar que você perca acesso aos recursos premium.
                  </p>
                </div>
                <Switch 
                  checked={autoRenew} 
                  onCheckedChange={setAutoRenew} 
                  className="data-[state=checked]:bg-vegas-green" 
                />
              </div>
            </div>
            
            {/* Payment Method */}
            <div>
              <h2 className="text-xl font-bold mb-4">Método de Pagamento</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {paymentMethods.map((method, index) => (
                  <div 
                    key={index}
                    className={`border rounded-lg p-4 relative ${method.selected ? 'border-vegas-green' : 'border-border'}`}
                  >
                    {method.selected && (
                      <div className="absolute -top-2 -right-2 bg-vegas-green rounded-full p-1">
                        <CheckCircle className="h-4 w-4 text-black" />
                      </div>
                    )}
                    <div className="flex items-center mb-2">
                      <div className="w-8 h-6 bg-vegas-black rounded-md mr-2 flex items-center justify-center">
                        <span className="text-vegas-green text-xs font-bold">PIX</span>
                      </div>
                      <p>PIX</p>
                    </div>
                    <p className="text-gray-400 text-sm">Processado por Asaas</p>
                  </div>
                ))}
                
                {/* Add Payment Method */}
                <div 
                  className="border border-dashed border-gray-600 rounded-lg p-4 flex items-center justify-center cursor-pointer hover:border-vegas-green transition-colors"
                  onClick={() => {
                    toast({
                      title: "Funcionalidade em breve",
                      description: "A adição de novos métodos de pagamento estará disponível em breve."
                    });
                  }}
                >
                  <div className="flex flex-col items-center text-gray-400">
                    <PlusCircle className="h-6 w-6 mb-2" />
                    <p className="text-sm">Adicionar método</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Billing History */}
            <div>
              <h2 className="text-xl font-bold mb-4">Histórico de Faturamento</h2>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-vegas-black/60 border-b border-border">
                    <tr>
                      <th className="text-left p-4 font-medium">Data</th>
                      <th className="text-left p-4 font-medium">Detalhes</th>
                      <th className="text-left p-4 font-medium">Valor</th>
                      <th className="text-left p-4 font-medium">Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((item, index) => (
                      <tr key={index} className="border-b border-border last:border-0">
                        <td className="p-4">{item.date}</td>
                        <td className="p-4">{item.details}</td>
                        <td className="p-4">{item.amount}</td>
                        <td className="p-4">
                          <button className="text-vegas-green hover:underline">
                            {item.invoiceId}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      case 'profile':
      default:
        return (
          <div>
            {/* Profile Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-center gap-4">
                {avatar ? (
                  <img 
                    src={avatar} 
                    alt="Avatar"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-vegas-black/60 border border-border flex items-center justify-center text-xl">
                    {profileData.firstName ? profileData.firstName[0].toUpperCase() : 'U'}
                  </div>
                )}
                
                <div className="text-left">
                  <h2 className="font-medium text-lg">{profileData.firstName} {profileData.lastName}</h2>
                  <p className="text-gray-400 text-sm">{profileData.bio}</p>
                  <p className="text-gray-400 text-sm">{profileData.cityState}, {profileData.country}</p>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="ml-auto border-border text-gray-400 hover:text-white hover:bg-vegas-black/60"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              </div>
            </div>
            
            {/* Personal Information */}
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium text-left">Informações Pessoais</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-border text-gray-400 hover:text-white hover:bg-vegas-black/60"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">Primeiro Nome</p>
                  <p>{profileData.firstName}</p>
                </div>
                
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">Sobrenome</p>
                  <p>{profileData.lastName}</p>
                </div>
                
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">Email</p>
                  <p>{profileData.email}</p>
                </div>
                
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">Telefone</p>
                  <p>{profileData.phone || '--'}</p>
                </div>
                
                <div className="md:col-span-2 text-left">
                  <p className="text-sm text-gray-400 mb-1">Bio</p>
                  <p>{profileData.bio}</p>
                </div>
              </div>
            </div>
            
            {/* Address Information */}
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-md font-medium text-left">Endereço</h3>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="border-border text-gray-400 hover:text-white hover:bg-vegas-black/60"
                >
                  <Pencil className="h-3.5 w-3.5 mr-1" />
                  Editar
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">País</p>
                  <p>{profileData.country}</p>
                </div>
                
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">Cidade/Estado</p>
                  <p>{profileData.cityState}</p>
                </div>
                
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">CEP</p>
                  <p>{profileData.postalCode || '--'}</p>
                </div>
                
                <div className="text-left">
                  <p className="text-sm text-gray-400 mb-1">CPF/CNPJ</p>
                  <p>{profileData.taxId || '--'}</p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout>
      <div className="container max-w-5xl mx-auto py-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="md:w-64 shrink-0">
            <div className="border border-border rounded-lg bg-vegas-black p-4">
              <h2 className="text-lg font-bold mb-4">Conta</h2>
              <nav className="space-y-1">
                {menuItems.map(item => (
                  <button
                    key={item.id}
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-vegas-black/60 w-full text-left ${activeTab === item.id ? 'bg-vegas-black/60 text-vegas-green' : 'text-gray-400'}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <div className="border border-border rounded-lg bg-vegas-black overflow-hidden">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 