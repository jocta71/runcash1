import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
  Box, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  CardHeader, 
  CardActions,
  Typography, 
  Button, 
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import useAuth from '../hooks/useAuth';

const PlansPage = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Buscar planos disponíveis
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/subscription/plans');
        
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
          setPlans(response.data.data);
        } else {
          // Se não conseguir obter os planos da API, mostrar planos de fallback
          setPlans([
            {
              _id: 'basic',
              name: 'Básico',
              price: 29.90,
              cycle: 'MONTHLY',
              features: [
                'Acesso a todas as roletas',
                'Dados históricos (últimos 100 números)',
                'Estatísticas básicas'
              ],
              active: true
            },
            {
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
              ],
              active: true,
              featured: true
            },
            {
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
              ],
              active: true
            }
          ]);
        }
      } catch (error) {
        console.error('Erro ao buscar planos:', error);
        toast.error('Não foi possível carregar os planos disponíveis');
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  // Iniciar checkout para o plano selecionado
  const handleSelectPlan = (plan) => {
    if (!isAuthenticated) {
      toast.info('Faça login para assinar um plano');
      navigate('/login', { 
        state: { 
          returnUrl: '/planos',
          message: 'Para assinar um plano, é necessário estar logado.'
        } 
      });
      return;
    }
    
    setSelectedPlan(plan);
    
    // Configurar o Asaas Checkout
    const script = document.createElement('script');
    script.src = 'https://www.asaas.com/checkouts.js';
    script.async = true;
    script.onload = () => {
      if (window.Asaas) {
        createAsaasCheckout(plan);
      } else {
        toast.error('Não foi possível carregar o checkout');
      }
    };
    document.body.appendChild(script);
  };
  
  // Criar checkout do Asaas
  const createAsaasCheckout = async (plan) => {
    try {
      // Abrir o modal de checkout do Asaas
      // Na implementação real, você deve chamar a API para criar uma assinatura e obter o link de checkout
      toast.info('Iniciando checkout...');
      
      // Exemplo de implementação com modal personalizado
      // Na versão final, você usaria o modal oficial do Asaas ou redirecionaria para a URL de checkout
      navigate(`/checkout/${plan._id}`);
    } catch (error) {
      console.error('Erro ao iniciar checkout:', error);
      toast.error('Erro ao processar o checkout. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', height: '70vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" gutterBottom>
          Escolha seu Plano
        </Typography>
        <Typography variant="subtitle1" color="textSecondary">
          Acesse dados em tempo real e estatísticas avançadas das roletas
        </Typography>
      </Box>
      
      <Grid container spacing={4} justifyContent="center">
        {plans.map((plan) => (
          <Grid item key={plan._id} xs={12} sm={6} md={4}>
            <Card 
              raised={plan.featured} 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                border: plan.featured ? '2px solid #3f51b5' : 'none',
                position: 'relative'
              }}
            >
              {plan.featured && (
                <Box 
                  sx={{ 
                    position: 'absolute', 
                    top: 10, 
                    right: 0,
                    backgroundColor: '#3f51b5',
                    color: 'white',
                    px: 2,
                    py: 0.5,
                    borderTopLeftRadius: 4,
                    borderBottomLeftRadius: 4
                  }}
                >
                  <Typography variant="body2">Mais Popular</Typography>
                </Box>
              )}
              
              <CardHeader
                title={plan.name}
                titleTypographyProps={{ align: 'center', variant: 'h5' }}
                sx={{ backgroundColor: plan.featured ? '#f5f5ff' : 'transparent' }}
              />
              
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', mb: 2 }}>
                  <Typography component="h2" variant="h3" color="primary">
                    R$ {plan.price.toFixed(2)}
                  </Typography>
                  <Typography variant="subtitle1" color="text.secondary">
                    /mês
                  </Typography>
                </Box>
                
                <Divider sx={{ my: 2 }} />
                
                <List>
                  {plan.features.map((feature, index) => (
                    <ListItem key={index} sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 35 }}>
                        <CheckIcon color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText 
                        primary={feature} 
                        primaryTypographyProps={{ variant: 'body2' }} 
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
              
              <CardActions sx={{ pt: 0, pb: 3, px: 3 }}>
                <Button 
                  fullWidth 
                  variant={plan.featured ? 'contained' : 'outlined'} 
                  color="primary"
                  onClick={() => handleSelectPlan(plan)}
                >
                  Assinar Agora
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      
      <Box mt={8} textAlign="center">
        <Typography variant="body2" color="textSecondary">
          Os planos são renovados automaticamente. Você pode cancelar a qualquer momento.
        </Typography>
        <Typography variant="body2" color="textSecondary" mt={1}>
          Pagamentos processados de forma segura pelo Asaas.
        </Typography>
      </Box>
    </Container>
  );
};

export default PlansPage; 