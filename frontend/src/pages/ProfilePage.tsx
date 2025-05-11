import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { Pencil, User, CreditCard, Bell, Shield, Users, Database, Trash, ChevronRight } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import { Textarea } from '@/components/ui/textarea';
import { Link, useLocation, useNavigate } from 'react-router-dom';

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
  displayName?: string;
  givenName?: string;
  familyName?: string;
}

const ProfilePage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('profile');
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

  useEffect(() => {
    if (user) {
      const extUser = user as unknown as ExtendedUser;
      
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
    });
    
    console.log('Dados a serem salvos:', profileData);
  };

  const menuItems = [
    { id: 'profile', label: 'Meu Perfil', icon: <User size={18} /> },
    { id: 'security', label: 'Segurança', icon: <Shield size={18} /> },
    { id: 'teams', label: 'Equipes', icon: <Users size={18} /> },
    { id: 'notifications', label: 'Notificações', icon: <Bell size={18} /> },
    { id: 'billing', label: 'Faturamento', icon: <CreditCard size={18} /> },
    { id: 'data-export', label: 'Exportar Dados', icon: <Database size={18} /> },
  ];

  return (
    <Layout>
      <div className="container py-6">
        <h1 className="text-2xl font-bold mb-6">Minha Conta</h1>
        
        {/* Breadcrumb/Navigation */}
        <div className="mb-6 flex items-center text-sm text-gray-400">
          <span>Conta</span>
          <ChevronRight className="h-4 w-4 mx-1" />
          <span className="text-vegas-green">Perfil</span>
        </div>
        
        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar/Navigation */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 border border-border rounded-lg overflow-hidden">
              {/* Profile Card */}
              <div className="bg-vegas-black/80 p-4 border-b border-border">
                <div className="flex items-center gap-3 mb-4">
                  {avatar ? (
                    <img 
                      src={avatar} 
                      alt="Avatar"
                      className="w-12 h-12 rounded-full object-cover border border-vegas-green/20"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-vegas-green/10 border border-vegas-green/20 flex items-center justify-center text-vegas-green">
                      {profileData.firstName ? profileData.firstName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  <div>
                    <h3 className="font-medium">{profileData.firstName} {profileData.lastName}</h3>
                    <p className="text-xs text-gray-400">{profileData.email}</p>
                  </div>
                </div>
              </div>
              
              {/* Navigation Menu */}
              <nav className="bg-vegas-black">
                {menuItems.map(item => (
                  <Link
                    key={item.id}
                    to={`/profile/${item.id}`}
                    className={`flex items-center justify-between px-4 py-3 border-b border-border transition-colors
                      ${activeTab === item.id 
                        ? 'bg-vegas-green/10 text-vegas-green border-l-2 border-l-vegas-green' 
                        : 'text-gray-400 hover:bg-vegas-black/70'}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    <div className="flex items-center">
                      <span className="w-5 h-5 mr-2 flex items-center justify-center">
                        {item.icon}
                      </span>
                      <span className="text-sm">{item.label}</span>
                    </div>
                    {activeTab === item.id && <ChevronRight className="h-4 w-4" />}
                  </Link>
                ))}
                
                {/* Delete Account (separated visually) */}
                <div className="p-4 border-t border-border mt-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full justify-start text-red-500 border-red-500/20 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Excluir Conta
                  </Button>
                </div>
              </nav>
            </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="border border-border rounded-lg overflow-hidden">
              {/* Profile Header */}
              <div className="bg-vegas-black/80 p-5 border-b border-border">
                <h2 className="text-xl font-bold">Informações Pessoais</h2>
                <p className="text-sm text-gray-400 mt-1">
                  Atualize seus dados pessoais e endereço
                </p>
              </div>
              
              <div className="p-6 bg-vegas-black space-y-8">
                {/* Personal Information Section */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium text-vegas-green">Dados Pessoais</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-vegas-green/20 text-vegas-green hover:bg-vegas-green/10"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Primeiro Nome</p>
                      <p className="font-medium">{profileData.firstName || '--'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Sobrenome</p>
                      <p className="font-medium">{profileData.lastName || '--'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Email</p>
                      <p className="font-medium">{profileData.email || '--'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Telefone</p>
                      <p className="font-medium">{profileData.phone || '--'}</p>
                    </div>
                    
                    <div className="md:col-span-2">
                      <p className="text-sm text-gray-400 mb-1">Bio</p>
                      <p className="font-medium">{profileData.bio || '--'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="h-px w-full bg-border"></div>
                
                {/* Address Information */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-md font-medium text-vegas-green">Endereço</h3>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="border-vegas-green/20 text-vegas-green hover:bg-vegas-green/10"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12">
                    <div>
                      <p className="text-sm text-gray-400 mb-1">País</p>
                      <p className="font-medium">{profileData.country || '--'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">Cidade/Estado</p>
                      <p className="font-medium">{profileData.cityState || '--'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">CEP</p>
                      <p className="font-medium">{profileData.postalCode || '--'}</p>
                    </div>
                    
                    <div>
                      <p className="text-sm text-gray-400 mb-1">CPF/CNPJ</p>
                      <p className="font-medium">{profileData.taxId || '--'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 