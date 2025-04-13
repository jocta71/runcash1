import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CustomSelect } from '@/components/ui/custom-select';
import { Pencil, X } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { useToast } from "@/components/ui/use-toast";
const ProfilePage = () => {
  const {
    toast
  } = useToast();
  const [avatar, setAvatar] = useState<string | null>('/lovable-uploads/63c79802-491a-4de2-97c9-26e0ab910245.png');
  const [profileData, setProfileData] = useState({
    firstName: 'Washim',
    lastName: 'Chowdhury',
    email: 'washim@gmail.com',
    phone: '+223465467',
    cityState: 'New York',
    country: 'USA',
    postalCode: '10001',
    taxId: 'US5342345',
    companyName: 'Flex',
    language: 'English',
    bio: 'Washim Chowdhury is a dedicated truck owner with 10 years of experience in transportation and logistics. Specializing in long-haul freight services. John ensures timely, safe, and reliable deliveries across the Midwest and East Coast regions. Known for his strong work ethic and commitment to quality, Washim takes pride in maintaining top-notch vehicles and building lasting client relationships.'
  });
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const {
      name,
      value
    } = e.target;
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
  return <div className="flex min-h-screen bg-[#0B0A0F]">
      <div className="w-64 flex-shrink-0">
        <Sidebar />
      </div>
      
      <div className="flex-1 p-6 md:p-10 overflow-auto">
        <div className="max-w-4xl mx-auto bg-[#1A191F] rounded-xl p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold mb-6 text-vegas-gold">My Profile</h1>
          
          <div className="mb-8 pb-6 border-b border-[#33333359]">
            <div className="flex items-center gap-6">
              <div className="relative">
                {avatar ? <img src={avatar} alt="Profile" className="w-20 h-20 rounded-full object-cover border-2 border-vegas-gold" /> : <div className="w-20 h-20 rounded-full bg-[#33333359] flex items-center justify-center text-vegas-gold text-2xl">
                    {profileData.firstName[0]}{profileData.lastName[0]}
                  </div>}
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleChangeAvatar} className="border-vegas-gold text-vegas-gold hover:bg-vegas-gold hover:text-black">
                  <Pencil size={16} className="mr-2" />
                  Change avatar
                </Button>
                
                <Button variant="outline" onClick={handleRemoveAvatar} className="border-[#33333359] text-white hover:bg-[#33333359]">
                  <X size={16} className="mr-2" />
                  Remove avatar
                </Button>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="firstName" className="text-white mb-2 block">First Name</Label>
                <Input id="firstName" name="firstName" value={profileData.firstName} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
              </div>
              
              <div>
                <Label htmlFor="email" className="text-white mb-2 block">Email Address</Label>
                <Input id="email" name="email" type="email" value={profileData.email} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
              </div>
              
              <div>
                
                
              </div>
              
              <div>
                
                
              </div>
              
              <div>
                
                
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="lastName" className="text-white mb-2 block">Last Name</Label>
                <Input id="lastName" name="lastName" value={profileData.lastName} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
              </div>
              
              <div>
                <Label htmlFor="phone" className="text-white mb-2 block">Phone</Label>
                <Input id="phone" name="phone" value={profileData.phone} onChange={handleInputChange} className="bg-[#111118] border-[#33333359] text-white" />
              </div>
              
              <div>
                
                <CustomSelect id="country" options={["USA", "Canada", "UK", "Australia", "Brazil"]} defaultValue={profileData.country} onChange={value => handleSelectChange("country", value)} className="bg-[#111118] border-[#33333359] text-white" />
              </div>
              
              <div>
                
                
              </div>
              
              <div>
                
                <CustomSelect id="language" options={["English", "Spanish", "Portuguese", "French", "German"]} defaultValue={profileData.language} onChange={value => handleSelectChange("language", value)} className="bg-[#111118] border-[#33333359] text-white" />
              </div>
            </div>
            
            
          </div>
          
          <div className="mt-8 flex justify-end gap-4">
            <Button variant="outline" className="border-[#33333359] text-white hover:bg-[#33333359]">
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-vegas-gold text-black hover:bg-vegas-darkgold">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>;
};
export default ProfilePage;