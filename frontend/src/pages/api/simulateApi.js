// Simulação de API para testes de assinatura
import axios from 'axios';

// Base de dados simulada
let testDatabase = {
  users: [],
  customers: [],
  subscriptions: [],
  payments: []
};

// Funções auxiliares
const generateId = (prefix) => `${prefix}_${Math.random().toString(36).substring(2, 10)}`;
const getCurrentTimestamp = () => new Date().toISOString();

// Função para resetar o banco de dados de teste
export const resetTestDatabase = () => {
  testDatabase = {
    users: [],
    customers: [],
    subscriptions: [],
    payments: []
  };
  
  // Salvar no localStorage para persistência
  localStorage.setItem('subscription_test_database', JSON.stringify(testDatabase));
  
  return { success: true, message: 'Banco de dados de teste resetado' };
};

// Função para carregar o banco de dados do localStorage
export const loadTestDatabase = () => {
  const savedData = localStorage.getItem('subscription_test_database');
  if (savedData) {
    try {
      testDatabase = JSON.parse(savedData);
      return { success: true, message: 'Banco de dados carregado com sucesso' };
    } catch (err) {
      console.error('Erro ao carregar banco de dados:', err);
      return { success: false, message: 'Erro ao carregar banco de dados' };
    }
  }
  return { success: false, message: 'Nenhum banco de dados encontrado' };
};

// Função para salvar o banco de dados no localStorage
const saveTestDatabase = () => {
  try {
    localStorage.setItem('subscription_test_database', JSON.stringify(testDatabase));
    return true;
  } catch (err) {
    console.error('Erro ao salvar banco de dados:', err);
    return false;
  }
};

// Carregar dados salvos se existirem
loadTestDatabase();

// API Simulada: Registro de usuário
export const simulateRegister = async (userData) => {
  // Verificar se o email já existe
  const existingUser = testDatabase.users.find(user => user.email === userData.email);
  if (existingUser) {
    throw new Error('Email já cadastrado');
  }
  
  // Criar novo usuário
  const newUser = {
    id: generateId('user'),
    username: userData.username,
    email: userData.email,
    password: userData.password, // Em uma aplicação real, seria hash
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp(),
    asaasCustomerId: null
  };
  
  testDatabase.users.push(newUser);
  saveTestDatabase();
  
  return {
    success: true,
    user: { ...newUser, password: undefined }, // Não retornar a senha
    token: `test_token_${newUser.id}`
  };
};

// API Simulada: Login
export const simulateLogin = async (credentials) => {
  // Buscar usuário pelo email
  const user = testDatabase.users.find(user => user.email === credentials.email);
  
  // Verificar se o usuário existe e se a senha está correta
  if (!user || user.password !== credentials.password) {
    throw new Error('Credenciais inválidas');
  }
  
  return {
    success: true,
    user: { ...user, password: undefined }, // Não retornar a senha
    token: `test_token_${user.id}`
  };
};

// API Simulada: Criar cliente no Asaas
export const simulateCreateCustomer = async (customerData) => {
  // Criar novo cliente
  const newCustomer = {
    id: generateId('cus'),
    name: customerData.name,
    email: customerData.email,
    cpfCnpj: customerData.cpfCnpj,
    mobilePhone: customerData.mobilePhone,
    userId: customerData.userId,
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  testDatabase.customers.push(newCustomer);
  
  // Atualizar usuário com o ID do cliente
  const userIndex = testDatabase.users.findIndex(user => user.id === customerData.userId);
  if (userIndex >= 0) {
    testDatabase.users[userIndex].asaasCustomerId = newCustomer.id;
  }
  
  saveTestDatabase();
  
  return {
    success: true,
    id: newCustomer.id
  };
};

// API Simulada: Criar assinatura
export const simulateCreateSubscription = async (subscriptionData) => {
  // Verificar se o cliente existe
  const customer = testDatabase.customers.find(cust => cust.id === subscriptionData.customerId);
  if (!customer) {
    throw new Error('Cliente não encontrado');
  }
  
  // Criar novo pagamento
  const paymentId = generateId('pay');
  const newPayment = {
    id: paymentId,
    customerId: customer.id,
    value: getValueForPlan(subscriptionData.planId),
    status: 'PENDING',
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  testDatabase.payments.push(newPayment);
  
  // Criar nova assinatura
  const subscriptionId = generateId('sub');
  const newSubscription = {
    id: subscriptionId,
    customerId: customer.id,
    planId: subscriptionData.planId,
    status: 'INACTIVE',
    paymentId: paymentId,
    createdAt: getCurrentTimestamp(),
    updatedAt: getCurrentTimestamp()
  };
  
  testDatabase.subscriptions.push(newSubscription);
  saveTestDatabase();
  
  // Gerar link de pagamento simulado
  const paymentLink = `/payment-test?paymentId=${paymentId}&subscriptionId=${subscriptionId}`;
  
  return {
    success: true,
    id: subscriptionId,
    paymentId: paymentId,
    paymentLink: paymentLink
  };
};

// API Simulada: Verificar status da assinatura
export const simulateCheckSubscriptionStatus = async (userId) => {
  // Buscar usuário
  const user = testDatabase.users.find(user => user.id === userId);
  if (!user) {
    throw new Error('Usuário não encontrado');
  }
  
  // Se o usuário não tem ID de cliente no Asaas
  if (!user.asaasCustomerId) {
    return {
      success: true,
      hasSubscription: false,
      message: 'Usuário não possui assinatura'
    };
  }
  
  // Buscar assinaturas do cliente
  const subscriptions = testDatabase.subscriptions.filter(
    sub => sub.customerId === user.asaasCustomerId
  );
  
  // Se não tem assinaturas
  if (subscriptions.length === 0) {
    return {
      success: true,
      hasSubscription: false,
      message: 'Usuário não possui assinatura'
    };
  }
  
  // Pegar a assinatura mais recente
  const latestSubscription = subscriptions.reduce((latest, current) => {
    return new Date(current.createdAt) > new Date(latest.createdAt) ? current : latest;
  }, subscriptions[0]);
  
  return {
    success: true,
    hasSubscription: latestSubscription.status === 'ACTIVE',
    subscription: latestSubscription
  };
};

// API Simulada: Aprovar pagamento
export const simulatePaymentApproval = async (subscriptionId) => {
  // Buscar assinatura
  const subscriptionIndex = testDatabase.subscriptions.findIndex(sub => sub.id === subscriptionId);
  if (subscriptionIndex < 0) {
    throw new Error('Assinatura não encontrada');
  }
  
  // Atualizar status da assinatura
  testDatabase.subscriptions[subscriptionIndex].status = 'ACTIVE';
  testDatabase.subscriptions[subscriptionIndex].updatedAt = getCurrentTimestamp();
  
  // Buscar pagamento associado
  const paymentId = testDatabase.subscriptions[subscriptionIndex].paymentId;
  const paymentIndex = testDatabase.payments.findIndex(pay => pay.id === paymentId);
  
  // Atualizar status do pagamento
  if (paymentIndex >= 0) {
    testDatabase.payments[paymentIndex].status = 'CONFIRMED';
    testDatabase.payments[paymentIndex].updatedAt = getCurrentTimestamp();
  }
  
  saveTestDatabase();
  
  return {
    success: true,
    message: 'Pagamento aprovado e assinatura ativada',
    subscription: testDatabase.subscriptions[subscriptionIndex]
  };
};

// API Simulada: Buscar dados de roletas
export const simulateGetRoulettes = async (userId) => {
  // Verificar status da assinatura
  try {
    const subscriptionStatus = await simulateCheckSubscriptionStatus(userId);
    
    // Se não tem assinatura ativa, não permite acesso
    if (!subscriptionStatus.hasSubscription) {
      throw new Error('Acesso negado: assinatura requerida');
    }
    
    // Retornar dados simulados de roletas
    return generateMockRoulettes();
  } catch (error) {
    throw new Error('Erro ao verificar assinatura ou buscar dados');
  }
};

// Utilitário: Valor baseado no plano
function getValueForPlan(planId) {
  switch (planId) {
    case 'basic':
      return 29.90;
    case 'pro':
      return 49.90;
    case 'premium':
      return 99.90;
    default:
      return 29.90;
  }
}

// Utilitário: Gerar dados simulados de roletas
function generateMockRoulettes() {
  const roulettes = [];
  const names = [
    'Lightning Roulette', 'American Roulette', 'European Roulette', 
    'French Roulette', 'Speed Roulette', 'Double Ball Roulette',
    'Grand Casino', 'Royal Casino', 'VIP Casino', 'Elite Casino',
    'Golden Palace', 'Silver Club', 'Diamond Room', 'Platinum Hall'
  ];
  
  for (let i = 0; i < names.length; i++) {
    roulettes.push({
      id: `R${i + 1}`,
      nome: names[i],
      ultima_atualizacao: getCurrentTimestamp(),
      numeros: generateRandomNumbers()
    });
  }
  
  return roulettes;
}

// Utilitário: Gerar números aleatórios para roletas
function generateRandomNumbers() {
  const numbers = [];
  const count = Math.floor(Math.random() * 20) + 10; // 10-30 números
  
  for (let i = 0; i < count; i++) {
    const num = Math.floor(Math.random() * 37); // 0-36
    numbers.push(num);
  }
  
  return numbers;
}

// Exportar todas as funções simuladas
export default {
  register: simulateRegister,
  login: simulateLogin,
  createCustomer: simulateCreateCustomer,
  createSubscription: simulateCreateSubscription,
  checkSubscriptionStatus: simulateCheckSubscriptionStatus,
  approvePayment: simulatePaymentApproval,
  getRoulettes: simulateGetRoulettes,
  resetDatabase: resetTestDatabase,
  loadDatabase: loadTestDatabase
}; 