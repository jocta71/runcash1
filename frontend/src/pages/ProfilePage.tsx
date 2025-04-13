import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CustomSelect } from '@/components/ui/custom-select';
import { Pencil, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from '@/context/AuthContext';
import Layout from '@/components/Layout';

const ProfilePage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    phone: '',
    cityState: '',
    country: 'Brasil',
    postalCode: '',
    taxId: '',
    companyName: '',
    language: 'Português',
    bio: ''
  });

  useEffect(() => {
    if (user) {
      const nameParts = user.username.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setAvatar(user.profilePicture || null);
      
      setProfileData(prev => ({
        ...prev,
        firstName,
        lastName,
        email: user.email || '',
        username: user.username || '',
      }));
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleChangeAvatar = () => {
    // In a real app, this would open a file picker
    toast({
      title: "Feature coming soon",
      description: "Avatar upload functionality will be available soon."
    });
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    toast({
      title: "Avatar removed",
      description: "Your profile avatar has been removed."
    });
  };

  const handleSave = () => {
    toast({
      title: "Profile updated",
      description: "Your profile information has been saved successfully.",
      variant: "default"
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto bg-[#1A191F] rounded-xl p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold mb-6 text-vegas-gold">Meu Perfil</h1>
        
        <div className="mb-8 pb-6 border-b border-[#33333359]">
          <div className="flex items-center gap-6">
            <div className="relative">
              {avatar ? 
                <img src={avatar} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-[#ffad33]" /> : 
                <div className="w-20 h-20 rounded-full bg-[#33333359] flex items-center justify-center text-[#ffad33] text-2xl">
                  {profileData.firstName ? profileData.firstName[0] : ''}
                  {profileData.lastName ? profileData.lastName[0] : ''}
                </div>
              }
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-1">{user?.username || 'Usuário'}</h2>
              <p className="text-gray-400 text-sm">{user?.email || 'email@exemplo.com'}</p>
              <p className="text-gray-400 text-sm mt-1">ID: {user?.id || 'N/A'}</p>
              {user?.isAdmin && <p className="text-[#ffad33] text-sm mt-1">Administrador</p>}
            </div>
            
            <div className="flex gap-3 ml-auto">
              <Button variant="outline" onClick={handleChangeAvatar} className="border-[#ffad33] text-[#ffad33] hover:bg-[#ffad33] hover:text-black">
                <Pencil size={16} className="mr-2" />
                Alterar avatar
              </Button>
              
              <Button variant="outline" onClick={handleRemoveAvatar} className="border-[#33333359] text-white hover:bg-[#33333359]">
                <X size={16} className="mr-2" />
                Remover avatar
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-white mb-2 block">Nome de usuário</Label>
              <Input id="username" name="username" value={profileData.username} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="firstName" className="text-white mb-2 block">Nome</Label>
              <Input id="firstName" name="firstName" value={profileData.firstName} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="email" className="text-white mb-2 block">Email</Label>
              <Input id="email" name="email" type="email" value={profileData.email} onChange={handleInputChange} readOnly className="bg-[#111118] border-[#33333359] text-white opacity-70" />
              <p className="text-xs text-gray-400 mt-1">O email não pode ser alterado</p>
            </div>
            
            <div>
              <Label htmlFor="cityState" className="text-white mb-2 block">Cidade/Estado</Label>
              <Input id="cityState" name="cityState" value={profileData.cityState} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="postalCode" className="text-white mb-2 block">CEP</Label>
              <Input id="postalCode" name="postalCode" value={profileData.postalCode} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="lastName" className="text-white mb-2 block">Sobrenome</Label>
              <Input id="lastName" name="lastName" value={profileData.lastName} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="phone" className="text-white mb-2 block">Telefone</Label>
              <Input id="phone" name="phone" value={profileData.phone} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="country" className="text-white mb-2 block">País</Label>
              <CustomSelect id="country" options={["Brasil", "EUA", "Canadá", "Reino Unido", "Austrália"]} defaultValue={profileData.country} onChange={value => handleSelectChange("country", value)} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="taxId" className="text-white mb-2 block">CPF/CNPJ</Label>
              <Input id="taxId" name="taxId" value={profileData.taxId} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
            
            <div>
              <Label htmlFor="language" className="text-white mb-2 block">Idioma</Label>
              <CustomSelect id="language" options={["Português", "Inglês", "Espanhol", "Francês", "Alemão"]} defaultValue={profileData.language} onChange={value => handleSelectChange("language", value)} className="bg-[#111118] border-[#33333359] text-white" />
            </div>
          </div>
        </div>
        
        <div className="mt-6">
          <Label htmlFor="bio" className="text-white mb-2 block">Bio</Label>
          <Textarea 
            id="bio" 
            name="bio" 
            value={profileData.bio} 
            onChange={handleInputChange} 
            rows={4}
            className="bg-[#111118] border-[#33333359] text-white w-full resize-none"
          />
        </div>
        
        <div className="mt-8 flex justify-end gap-4">
          <Button variant="outline" className="border-[#33333359] text-white hover:bg-[#33333359]">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-[#ffad33] text-black hover:bg-[#cc8a29]">
            Salvar
          </Button>
        </div>
        
        <div className="mt-8 pt-6 border-t border-[#33333359]">
          <h2 className="text-lg font-bold mb-4 text-vegas-gold">Informações da conta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#111118] p-4 rounded-lg">
              <p className="text-gray-400 text-sm">ID da conta</p>
              <p className="text-white font-mono">{user?.id || 'N/A'}</p>
            </div>
            <div className="bg-[#111118] p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Google ID</p>
              <p className="text-white font-mono">{user?.googleId || 'N/A'}</p>
            </div>
            <div className="bg-[#111118] p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Conta criada em</p>
              <p className="text-white">{user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'N/A'}</p>
            </div>
            <div className="bg-[#111118] p-4 rounded-lg">
              <p className="text-gray-400 text-sm">Último acesso</p>
              <p className="text-white">{user?.lastLogin ? new Date(user.lastLogin).toLocaleDateString('pt-BR') : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage; 