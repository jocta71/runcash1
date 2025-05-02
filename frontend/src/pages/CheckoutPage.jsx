import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Paper,
  Divider,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Step,
  StepLabel,
  Stepper
} from '@mui/material';
import { 
  CreditCard as CreditCardIcon,
  Lock as LockIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import useAuth from '../hooks/useAuth';

// Componentes para o formulário de cartão de crédito
const CreditCardForm = ({ formData, setFormData, errors, setErrors }) => {
  // Função para validar os campos
  const validateField = (field, value) => {
    switch (field) {
      case 'cardNumber':
        return value.replace(/\D/g, '').length === 16 ? '' : 'Número de cartão inválido';
      case 'cardName':
        return value.trim().length > 5 ? '' : 'Nome deve ter pelo menos 6 caracteres';
      case 'cardExpiry':
        const [month, year] = value.split('/');
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        
        if (!month || !year || month > 12 || month < 1) {
          return 'Data inválida';
        }
        
        if (parseInt(year) < currentYear || 
            (parseInt(year) === currentYear && parseInt(month) < currentMonth)) {
          return 'Cartão expirado';
        }
        
        return '';
      case 'cardCVV':
        return value.length >= 3 ? '' : 'CVV inválido';
      default:
        return '';
    }
  };

  // Handler para mudanças nos campos
  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    
    // Formatar os campos
    if (name === 'cardNumber') {
      // Formatar: XXXX XXXX XXXX XXXX
      formattedValue = value
        .replace(/\D/g, '')
        .slice(0, 16)
        .replace(/(.{4})/g, '$1 ')
        .trim();
    } else if (name === 'cardExpiry') {
      // Formatar: MM/YY
      const digits = value.replace(/\D/g, '').slice(0, 4);
      if (digits.length > 2) {
        formattedValue = `${digits.slice(0, 2)}/${digits.slice(2)}`;
      } else {
        formattedValue = digits;
      }
    } else if (name === 'cardCVV') {
      // Apenas dígitos, máximo 4
      formattedValue = value.replace(/\D/g, '').slice(0, 4);
    }
    
    // Atualizar dados do formulário
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
    
    // Validar e atualizar erros
    const error = validateField(name, formattedValue);
    setErrors(prev => ({
      ...prev,
      [name]: error
    }));
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Nome no Cartão"
          name="cardName"
          value={formData.cardName || ''}
          onChange={handleChange}
          error={!!errors.cardName}
          helperText={errors.cardName}
          required
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          fullWidth
          label="Número do Cartão"
          name="cardNumber"
          value={formData.cardNumber || ''}
          onChange={handleChange}
          error={!!errors.cardNumber}
          helperText={errors.cardNumber}
          required
          InputProps={{
            startAdornment: <CreditCardIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="Validade (MM/AA)"
          name="cardExpiry"
          value={formData.cardExpiry || ''}
          onChange={handleChange}
          error={!!errors.cardExpiry}
          helperText={errors.cardExpiry}
          required
          placeholder="MM/AA"
        />
      </Grid>
      <Grid item xs={6}>
        <TextField
          fullWidth
          label="CVV"
          name="cardCVV"
          value={formData.cardCVV || ''}
          onChange={handleChange}
          error={!!errors.cardCVV}
          helperText={errors.cardCVV}
          required
          type="password"
          InputProps={{
            startAdornment: <LockIcon sx={{ mr: 1, color: 'text.secondary' }} />
          }}
        />
      </Grid>
    </Grid>
  );
};

// Componente de pagamento concluído
const PaymentCompleted = ({ subscription }) => {
  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CheckCircleIcon sx={{ fontSize: 70, color: 'success.main', mb: 2 }} />
      <Typography variant="h5" gutterBottom>
        Pagamento Concluído!
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Seu plano está ativo até {new Date(subscription?.expiresAt).toLocaleDateString('pt-BR')}
      </Typography>
      <Button 
        variant="contained" 
        color="primary"
        href="/dashboard"
        sx={{ mt: 2 }}
      >
        Ir para o Dashboard
      </Button>
    </Box>
  );
};

// Componente principal de checkout
const CheckoutPage = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [plan, setPlan] = useState(null);
  const [subscription, setSubscription] = useState(null);
  
  const [formData, setFormData] = useState({
    cardName: '',
    cardNumber: '',
    cardExpiry: '',
    cardCVV: '',
    // Dados de contato e endereço
    name: user?.name || '',
    email: user?.email || '',
    cpf: '',
    phone: '',
    postalCode: '',
    addressNumber: ''
  });
  
  const [errors, setErrors] = useState({});
  
  // Buscar detalhes do plano
  useEffect(() => {
    // Verificar autenticação
    if (!isAuthenticated) {
      toast.error('Você precisa estar logado para fazer uma assinatura');
      navigate('/login', { 
        state: { 
          returnUrl: `/checkout/${planId}`,
          message: 'Para continuar o checkout, é necessário estar logado.' 
        } 
      });
      return;
    }
    
    const fetchPlanDetails = async () => {
      try {
        setLoading(true);
        // Na implementação real, buscar detalhes do plano da API
        const response = await axios.get('/api/subscription/plans');
        
        let selectedPlan = null;
        
        if (response.data?.success && Array.isArray(response.data.data)) {
          selectedPlan = response.data.data.find(p => p._id === planId);
        }
        
        // Se não encontrar o plano na API, usar dados padrão (simulado)
        if (!selectedPlan) {
          const defaultPlans = {
            'basic': {
              _id: 'basic',
              name: 'Básico',
              price: 29.90,
              cycle: 'MONTHLY',
              features: [
                'Acesso a todas as roletas',
                'Dados históricos (últimos 100 números)',
                'Estatísticas básicas'
              ]
            },
            'pro': {
              _id: 'pro',
              name: 'Profissional',
              price: 49.90,
              cycle: 'MONTHLY',
              features: [
                'Todos os recursos do plano Básico',
                'Dados históricos (últimos 500 números)',
                'Estatísticas avançadas',
                'Alertas de oportunidades',
                'Suporte prioritário'
              ]
            },
            'premium': {
              _id: 'premium',
              name: 'Premium',
              price: 89.90,
              cycle: 'MONTHLY',
              features: [
                'Todos os recursos do plano Profissional',
                'Dados históricos completos',
                'Análise preditiva avançada',
                'Acesso à API',
                'Suporte VIP 24/7'
              ]
            }
          };
          
          selectedPlan = defaultPlans[planId];
        }
        
        if (!selectedPlan) {
          toast.error('Plano não encontrado');
          navigate('/planos');
          return;
        }
        
        setPlan(selectedPlan);
      } catch (error) {
        console.error('Erro ao buscar detalhes do plano:', error);
        toast.error('Erro ao carregar detalhes do plano');
        navigate('/planos');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPlanDetails();
  }, [planId, navigate, isAuthenticated, user]);
  
  // Verificar se todos os campos estão preenchidos e válidos
  const validateForm = () => {
    // Validar campos do cartão
    const cardErrors = {
      cardName: !formData.cardName ? 'Nome no cartão é obrigatório' : '',
      cardNumber: !formData.cardNumber ? 'Número do cartão é obrigatório' : 
                  formData.cardNumber.replace(/\D/g, '').length !== 16 ? 'Número de cartão inválido' : '',
      cardExpiry: !formData.cardExpiry ? 'Data de validade é obrigatória' : '',
      cardCVV: !formData.cardCVV ? 'CVV é obrigatório' : ''
    };
    
    // Validar dados pessoais
    const personalErrors = {
      name: !formData.name ? 'Nome é obrigatório' : '',
      email: !formData.email ? 'Email é obrigatório' : '',
      cpf: !formData.cpf ? 'CPF é obrigatório' : '',
      phone: !formData.phone ? 'Telefone é obrigatório' : '',
      postalCode: !formData.postalCode ? 'CEP é obrigatório' : '',
      addressNumber: !formData.addressNumber ? 'Número é obrigatório' : ''
    };
    
    // Combinar erros com base na etapa atual
    const currentErrors = activeStep === 0 ? personalErrors : cardErrors;
    
    setErrors(currentErrors);
    
    // Verificar se há algum erro
    return !Object.values(currentErrors).some(error => error);
  };
  
  // Avançar para a próxima etapa
  const handleNext = () => {
    if (validateForm()) {
      setActiveStep(prevStep => prevStep + 1);
    }
  };
  
  // Voltar para a etapa anterior
  const handleBack = () => {
    setActiveStep(prevStep => prevStep - 1);
  };
  
  // Processar o pagamento
  const handleSubmitPayment = async () => {
    try {
      setProcessingPayment(true);
      
      // Extrair mês e ano da data de validade
      const [expiryMonth, expiryYear] = formData.cardExpiry.split('/');
      
      // Preparar dados para a API
      const paymentData = {
        planId: planId,
        customer: {
          name: formData.name,
          email: formData.email,
          cpfCnpj: formData.cpf.replace(/\D/g, ''),
          phone: formData.phone.replace(/\D/g, ''),
          postalCode: formData.postalCode.replace(/\D/g, ''),
          addressNumber: formData.addressNumber
        },
        creditCard: {
          holderName: formData.cardName,
          number: formData.cardNumber.replace(/\D/g, ''),
          expiryMonth,
          expiryYear,
          ccv: formData.cardCVV
        }
      };
      
      // Enviar para a API
      const response = await axios.post('/api/subscription/create', paymentData);
      
      if (response.data && response.data.success) {
        toast.success('Assinatura criada com sucesso!');
        setSubscription({
          ...response.data.data,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Simular 30 dias
        });
        setActiveStep(3); // Avançar para tela de sucesso
      } else {
        throw new Error(response.data?.message || 'Erro ao processar pagamento');
      }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      toast.error(error.response?.data?.message || 'Erro ao processar pagamento');
    } finally {
      setProcessingPayment(false);
    }
  };
  
  // Handler para mudanças nos campos de dados pessoais
  const handlePersonalInfoChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;
    
    // Formatar os campos
    if (name === 'cpf') {
      // Formatar: XXX.XXX.XXX-XX
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 3) {
        formattedValue = digits;
      } else if (digits.length <= 6) {
        formattedValue = `${digits.slice(0, 3)}.${digits.slice(3)}`;
      } else if (digits.length <= 9) {
        formattedValue = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      } else {
        formattedValue = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
      }
    } else if (name === 'phone') {
      // Formatar: (XX) XXXXX-XXXX
      const digits = value.replace(/\D/g, '').slice(0, 11);
      if (digits.length <= 2) {
        formattedValue = digits;
      } else if (digits.length <= 7) {
        formattedValue = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
      } else {
        formattedValue = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
      }
    } else if (name === 'postalCode') {
      // Formatar: XXXXX-XXX
      const digits = value.replace(/\D/g, '').slice(0, 8);
      if (digits.length <= 5) {
        formattedValue = digits;
      } else {
        formattedValue = `${digits.slice(0, 5)}-${digits.slice(5)}`;
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
    
    // Limpar erro do campo
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Container>
    );
  }
  
  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Paper elevation={3} sx={{ p: { xs: 2, md: 4 } }}>
        <Typography variant="h4" gutterBottom align="center">
          Finalizar Assinatura
        </Typography>
        
        {/* Stepper */}
        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          <Step>
            <StepLabel>Dados Pessoais</StepLabel>
          </Step>
          <Step>
            <StepLabel>Pagamento</StepLabel>
          </Step>
          <Step>
            <StepLabel>Confirmação</StepLabel>
          </Step>
        </Stepper>
        
        {/* Conteúdo baseado na etapa atual */}
        {activeStep === 0 && (
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Nome Completo"
                name="name"
                value={formData.name}
                onChange={handlePersonalInfoChange}
                error={!!errors.name}
                helperText={errors.name}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handlePersonalInfoChange}
                error={!!errors.email}
                helperText={errors.email}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="CPF"
                name="cpf"
                value={formData.cpf}
                onChange={handlePersonalInfoChange}
                error={!!errors.cpf}
                helperText={errors.cpf}
                required
                placeholder="000.000.000-00"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Telefone"
                name="phone"
                value={formData.phone}
                onChange={handlePersonalInfoChange}
                error={!!errors.phone}
                helperText={errors.phone}
                required
                placeholder="(00) 00000-0000"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="CEP"
                name="postalCode"
                value={formData.postalCode}
                onChange={handlePersonalInfoChange}
                error={!!errors.postalCode}
                helperText={errors.postalCode}
                required
                placeholder="00000-000"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Número"
                name="addressNumber"
                value={formData.addressNumber}
                onChange={handlePersonalInfoChange}
                error={!!errors.addressNumber}
                helperText={errors.addressNumber}
                required
              />
            </Grid>
          </Grid>
        )}
        
        {activeStep === 1 && (
          <CreditCardForm 
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
          />
        )}
        
        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Resumo do Pedido
            </Typography>
            
            <Box sx={{ backgroundColor: 'background.default', p: 2, borderRadius: 1, mb: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={8}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    {plan.name}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    Assinatura mensal - Renovação automática
                  </Typography>
                </Grid>
                <Grid item xs={4} sx={{ textAlign: 'right' }}>
                  <Typography variant="subtitle1" fontWeight="bold">
                    R$ {plan.price.toFixed(2)}
                  </Typography>
                </Grid>
              </Grid>
            </Box>
            
            <Divider sx={{ my: 2 }} />
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="body1">Total:</Typography>
              <Typography variant="h6" fontWeight="bold">
                R$ {plan.price.toFixed(2)}
              </Typography>
            </Box>
            
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="body2" color="textSecondary" paragraph>
                Ao confirmar, você autoriza a cobrança de R$ {plan.price.toFixed(2)} em seu cartão de crédito
                e concorda com os termos e condições do serviço.
              </Typography>
              <Typography variant="body2" color="textSecondary">
                A assinatura será renovada automaticamente a cada mês. 
                Você pode cancelar a qualquer momento na área do cliente.
              </Typography>
            </Box>
          </Box>
        )}
        
        {activeStep === 3 && (
          <PaymentCompleted subscription={subscription} />
        )}
        
        {/* Botões de navegação */}
        {activeStep < 3 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button 
              variant="outlined" 
              onClick={activeStep === 0 ? () => navigate('/planos') : handleBack}
              disabled={processingPayment}
            >
              {activeStep === 0 ? 'Voltar para planos' : 'Voltar'}
            </Button>
            
            {activeStep < 2 ? (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleNext}
              >
                Próximo
              </Button>
            ) : (
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleSubmitPayment}
                disabled={processingPayment}
              >
                {processingPayment ? <CircularProgress size={24} /> : 'Finalizar Compra'}
              </Button>
            )}
          </Box>
        )}
      </Paper>
    </Container>
  );
};

export default CheckoutPage; 