/**
 * Script para testar a rota /api/auth/me
 */

const express = require('express');
const app = express();
const PORT = 3000;

// Rota /api/auth/me que retorna usuário padrão
app.get('/api/auth/me', (req, res) => {
  const defaultUser = {
    _id: 'system-default-id',
    id: 'system-default-id',
    username: 'sistema',
    email: 'default@system.local',
    isAdmin: true,
    profilePicture: null,
    firstName: 'Usuário',
    lastName: 'Sistema',
    lastLogin: new Date(),
    createdAt: new Date(),
    role: 'admin',
    isPremium: true
  };
  
  res.status(200).json({
    success: true,
    data: defaultUser
  });
});

// Rota raiz para teste
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'API de teste funcionando'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor de teste rodando na porta ${PORT}`);
  console.log(`Teste a rota em: http://localhost:${PORT}/api/auth/me`);
}); 