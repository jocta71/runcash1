import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { Pencil, User, CreditCard, Bell, Shield, Users, Database, Trash } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import { Textarea } from '@/components/ui/textarea';
import { Link, useLocation } from 'react-router-dom';

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
  const location = useLocation();
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

  const menuItems = [
    { id: 'profile', label: 'Meu Perfil', icon: <User size={18} /> },
    { id: 'security', label: 'Segurança', icon: <Shield size={18} /> },
    { id: 'teams', label: 'Equipes', icon: <Users size={18} /> },
    { id: 'notifications', label: 'Notificações', icon: <Bell size={18} /> },
    { id: 'billing', label: 'Faturamento', icon: <CreditCard size={18} /> },
    { id: 'data-export', label: 'Exportar Dados', icon: <Database size={18} /> },
    { id: 'delete-account', label: 'Excluir Conta', icon: <Trash size={18} className="text-red-500" /> },
  ];

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
                  <Link
                    key={item.id}
                    to={`/profile/${item.id}`}
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors hover:bg-vegas-black/60 ${activeTab === item.id ? 'bg-vegas-black/60 text-vegas-green' : 'text-gray-400'}`}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.icon}
                    <span className="text-sm">{item.label}</span>
                  </Link>
                ))}
              </nav>
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1">
            <div className="border border-border rounded-lg bg-vegas-black overflow-hidden">
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
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 