import axios from 'axios';
import env from '@/config/env';

// Configuração do axios
const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Definição dos tipos
interface ProfileUpdateData {
  firstName?: string;
  lastName?: string;
  username?: string;
}

class UserService {
  // Obter token do localStorage
  private getAuthHeader() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
  
  // Atualizar perfil do usuário
  async updateProfile(data: ProfileUpdateData) {
    try {
      const response = await apiClient.put('/users/profile', data, {
        headers: this.getAuthHeader()
      });
      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  }
  
  // Fazer upload de foto de perfil
  async uploadProfilePicture(file: File) {
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const response = await apiClient.post('/users/profile/picture', formData, {
        headers: {
          ...this.getAuthHeader(),
          'Content-Type': 'multipart/form-data'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Erro ao fazer upload de imagem:', error);
      throw error;
    }
  }
  
  // Remover foto de perfil
  async removeProfilePicture() {
    try {
      const response = await apiClient.delete('/users/profile/picture', {
        headers: this.getAuthHeader()
      });
      
      return response.data;
    } catch (error) {
      console.error('Erro ao remover imagem de perfil:', error);
      throw error;
    }
  }
}

export default new UserService(); 