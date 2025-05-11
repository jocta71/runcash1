import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomSelect } from '@/components/ui/custom-select';
import { Pencil, Upload, Trash2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from '@/components/ui/textarea';

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
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    role: '',
    location: '',
    company: '',
    bio: '',
  });

  useEffect(() => {
    if (user) {
      // Cast para o tipo estendido para acessar as propriedades adicionais
      const extUser = user as unknown as ExtendedUser;
      
      // Tentar obter nome completo
      let fullName = '';
      
      if (extUser.firstName && extUser.lastName) {
        fullName = `${extUser.firstName} ${extUser.lastName}`;
      } 
      else if (extUser.givenName && extUser.familyName) {
        fullName = `${extUser.givenName} ${extUser.familyName}`;
      }
      else if (extUser.displayName) {
        fullName = extUser.displayName;
      }
      else if (extUser.username) {
        fullName = extUser.username;
      }
      
      setAvatar(extUser.profilePicture || null);
      
      setProfileData({
        fullName,
        email: extUser.email || '',
        role: 'Usuário',
        location: 'Brasil',
        company: '',
        bio: '',
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

  const handleFileUpload = () => {
    // Em uma aplicação real, isso abriria um seletor de arquivos
    toast({
      title: "Upload em breve",
      description: "A funcionalidade de upload de avatar estará disponível em breve."
    });
  };

  const handleDeleteAvatar = () => {
    setAvatar(null);
    toast({
      title: "Avatar removido",
      description: "Seu avatar de perfil foi removido com sucesso."
    });
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

  return (
    <Layout>
      <div className="container py-6 space-y-6">
        <div className="rounded-lg border border-border bg-vegas-black p-6">
          <Tabs defaultValue="profile" className="w-full">
            <TabsList className="bg-vegas-black border border-border mb-6">
              <TabsTrigger value="profile" className="data-[state=active]:bg-vegas-green data-[state=active]:text-black">
                Perfil
              </TabsTrigger>
              <TabsTrigger value="password" className="data-[state=active]:bg-vegas-green data-[state=active]:text-black">
                Senha
              </TabsTrigger>
              <TabsTrigger value="email" className="data-[state=active]:bg-vegas-green data-[state=active]:text-black">
                Email
              </TabsTrigger>
              <TabsTrigger value="notification" className="data-[state=active]:bg-vegas-green data-[state=active]:text-black">
                Notificações
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-vegas-green data-[state=active]:text-black">
                Configurações
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="profile" className="space-y-6">
              {/* Avatar Section */}
              <div className="mb-6">
                <h3 className="text-md font-medium mb-4">Seu Avatar</h3>
                <div className="flex items-start gap-4">
                  {avatar ? (
                    <img 
                      src={avatar} 
                      alt="Avatar"
                      className="w-16 h-16 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-vegas-black/40 border border-border flex items-center justify-center">
                      {profileData.fullName ? profileData.fullName[0].toUpperCase() : 'U'}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleFileUpload}
                        className="bg-vegas-green hover:bg-vegas-green/90 text-black"
                        size="sm"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Novo
                      </Button>
                      
                      <Button
                        onClick={handleDeleteAvatar}
                        variant="outline"
                        size="sm"
                        className="border-border hover:bg-vegas-black/40"
                      >
                        Deletar Avatar
                      </Button>
                    </div>
                    <p className="text-sm text-gray-400">
                      Avatar ajuda seus colegas a reconhecerem você no sistema.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Profile Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="fullName" className="text-sm font-medium text-gray-400 mb-1.5 block">
                    Nome Completo
                  </Label>
                  <Input
                    id="fullName"
                    name="fullName"
                    value={profileData.fullName}
                    onChange={handleInputChange}
                    className="bg-vegas-black/30 border-border"
                  />
                </div>
                
                <div>
                  <Label htmlFor="role" className="text-sm font-medium text-gray-400 mb-1.5 block">
                    Cargo
                  </Label>
                  <Input
                    id="role"
                    name="role"
                    value={profileData.role}
                    onChange={handleInputChange}
                    className="bg-vegas-black/30 border-border"
                  />
                </div>
                
                <div>
                  <Label htmlFor="location" className="text-sm font-medium text-gray-400 mb-1.5 block">
                    Localização
                  </Label>
                  <Input
                    id="location"
                    name="location"
                    value={profileData.location}
                    onChange={handleInputChange}
                    className="bg-vegas-black/30 border-border"
                  />
                </div>
                
                <div>
                  <Label htmlFor="company" className="text-sm font-medium text-gray-400 mb-1.5 block">
                    Empresa
                  </Label>
                  <Input
                    id="company"
                    name="company"
                    value={profileData.company}
                    onChange={handleInputChange}
                    className="bg-vegas-black/30 border-border"
                  />
                </div>
                
                <div className="md:col-span-2">
                  <Label htmlFor="bio" className="text-sm font-medium text-gray-400 mb-1.5 block">
                    Bio
                  </Label>
                  <Textarea
                    id="bio"
                    name="bio"
                    placeholder="Descreva sobre você e sua experiência..."
                    value={profileData.bio}
                    onChange={handleInputChange}
                    className="bg-vegas-black/30 border-border h-32"
                  />
                </div>
              </div>
              
              {/* Update Button */}
              <div className="pt-4">
                <Button 
                  onClick={handleUpdateProfile}
                  className="bg-vegas-green hover:bg-vegas-green/90 text-black"
                >
                  Atualizar Perfil
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="password">
              <div className="p-4 text-center">
                <p className="text-gray-400">
                  Configurações de senha estarão disponíveis em breve.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="email">
              <div className="p-4 text-center">
                <p className="text-gray-400">
                  Configurações de email estarão disponíveis em breve.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="notification">
              <div className="p-4 text-center">
                <p className="text-gray-400">
                  Configurações de notificações estarão disponíveis em breve.
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="settings">
              <div className="p-4 text-center">
                <p className="text-gray-400">
                  Configurações gerais estarão disponíveis em breve.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 