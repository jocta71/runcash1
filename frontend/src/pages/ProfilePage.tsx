import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, User, Check, Calendar, MapPin, Mail, Phone, Pencil, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ProfileFormData {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  dateOfBirth: string;
  country: string;
}

const ProfilePage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Mock data for the profile
  const [formData, setFormData] = useState<ProfileFormData>({
    firstName: 'Jane',
    lastName: 'Coop',
    email: 'jane234@example.com',
    phoneNumber: '(209) 555-0104',
    dateOfBirth: '17 nov, 1996',
    country: 'Bangladesh'
  });
  
  // Simulate loading user data
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleEdit = (field: string) => {
    setEditingField(field);
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      // Simulate API call to save profile
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSuccessMessage('Perfil atualizado com sucesso!');
      setEditingField(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError('Erro ao salvar alterações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="container mx-auto py-12 flex justify-center items-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Informações da Conta</h1>
      
      {successMessage && (
        <Alert className="mb-6 bg-green-500/20 border-green-500 text-white">
          <Check className="h-4 w-4 text-green-500" />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-6">
          {/* Profile Image */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                <img 
                  src="https://randomuser.me/api/portraits/women/44.jpg" 
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              </div>
              <button className="absolute bottom-0 right-0 bg-gray-900 text-white p-1 rounded-full">
                <User size={14} />
              </button>
            </div>
          </div>
          
          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* First Name */}
            <div>
              <Label htmlFor="firstName" className="text-gray-500 text-sm">First Name</Label>
              <div className="relative mt-1">
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange('firstName', e.target.value)}
                  disabled={editingField !== 'firstName'}
                  className="pr-10"
                />
                {editingField === 'firstName' ? (
                  <button
                    onClick={handleSave}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-600"
                  >
                    <Save size={18} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleEdit('firstName')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                  >
                    <Pencil size={18} />
                  </button>
                )}
              </div>
            </div>
            
            {/* Last Name */}
            <div>
              <Label htmlFor="lastName" className="text-gray-500 text-sm">Last Name</Label>
              <div className="relative mt-1">
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange('lastName', e.target.value)}
                  disabled={editingField !== 'lastName'}
                  className="pr-10"
                />
                {editingField === 'lastName' ? (
                  <button
                    onClick={handleSave}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-600"
                  >
                    <Save size={18} />
                  </button>
                ) : (
                  <button
                    onClick={() => handleEdit('lastName')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400"
                  >
                    <Pencil size={18} />
                  </button>
                )}
              </div>
            </div>
            
            {/* Email */}
            <div>
              <Label htmlFor="email" className="text-gray-500 text-sm flex items-center">
                Email
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full flex items-center">
                  <Check size={12} className="mr-1" /> Verified
                </span>
              </Label>
              <div className="relative mt-1">
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  disabled={editingField !== 'email'}
                  className="pr-10"
                />
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              </div>
            </div>
            
            {/* Phone Number */}
            <div>
              <Label htmlFor="phoneNumber" className="text-gray-500 text-sm flex items-center">
                Phone Number
                <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full flex items-center">
                  <Check size={12} className="mr-1" /> Verified
                </span>
              </Label>
              <div className="relative mt-1">
                <Input
                  id="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={(e) => handleInputChange('phoneNumber', e.target.value)}
                  disabled={editingField !== 'phoneNumber'}
                  className="pr-10"
                />
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              </div>
            </div>
            
            {/* Date of Birth */}
            <div>
              <Label htmlFor="dateOfBirth" className="text-gray-500 text-sm">Date of Birth</Label>
              <div className="relative mt-1">
                <Input
                  id="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  disabled={editingField !== 'dateOfBirth'}
                  className="pr-10"
                />
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              </div>
            </div>
            
            {/* Country */}
            <div>
              <Label htmlFor="country" className="text-gray-500 text-sm">Country</Label>
              <div className="relative mt-1">
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  disabled={editingField !== 'country'}
                  className="pr-10"
                />
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfilePage; 