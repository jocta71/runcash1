import React, { useState } from 'react';
import { Form, Button, Spinner, Alert, Card } from 'react-bootstrap';
import { createAsaasCustomer, findAsaasCustomer } from '../integrations/asaas/client';
import { useAuth } from '../context/AuthContext';

interface CustomerFormProps {
  onCustomerCreated?: (customerId: string) => void;
  onCustomerSelected?: (customerId: string) => void;
}

const CustomerForm: React.FC<CustomerFormProps> = ({
  onCustomerCreated,
  onCustomerSelected
}) => {
  const { user } = useAuth();
  
  // Estado para formulário de criação
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [cpfCnpj, setCpfCnpj] = useState<string>('');
  const [mobilePhone, setMobilePhone] = useState<string>('');
  
  // Estado para busca
  const [searchCpfCnpj, setSearchCpfCnpj] = useState<string>('');
  const [searchEmail, setSearchEmail] = useState<string>('');
  
  // Estados de UI
  const [loading, setLoading] = useState<boolean>(false);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [customerCreated, setCustomerCreated] = useState<string | null>(null);
  const [customerFound, setCustomerFound] = useState<any | null>(null);
  
  // Carregar dados do usuário quando disponível
  React.useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);
  
  // Formatar CPF/CNPJ (remover caracteres não numéricos)
  const formatCpfCnpj = (value: string) => {
    return value.replace(/\D/g, '');
  };
  
  // Formatar telefone (remover caracteres não numéricos)
  const formatPhone = (value: string) => {
    return value.replace(/\D/g, '');
  };
  
  // Criar cliente
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar campos
    if (!name || !email || !cpfCnpj) {
      setError('Nome, e-mail e CPF/CNPJ são obrigatórios.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setCustomerCreated(null);
    
    try {
      const customerId = await createAsaasCustomer({
        name,
        email,
        cpfCnpj: formatCpfCnpj(cpfCnpj),
        mobilePhone: formatPhone(mobilePhone),
        userId: user?.id || ''
      });
      
      setCustomerCreated(customerId);
      
      // Executar callback se existir
      if (onCustomerCreated) {
        onCustomerCreated(customerId);
      }
      
      // Limpar formulário
      setCpfCnpj('');
      setMobilePhone('');
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      setError(error instanceof Error ? error.message : 'Erro ao criar cliente');
    } finally {
      setLoading(false);
    }
  };
  
  // Buscar cliente
  const handleSearchCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar campos
    if (!searchCpfCnpj && !searchEmail) {
      setSearchError('Informe CPF/CNPJ ou e-mail para buscar.');
      return;
    }
    
    setSearchLoading(true);
    setSearchError(null);
    setCustomerFound(null);
    
    try {
      const customer = await findAsaasCustomer({
        cpfCnpj: searchCpfCnpj ? formatCpfCnpj(searchCpfCnpj) : undefined,
        email: searchEmail || undefined
      });
      
      if (customer) {
        setCustomerFound(customer);
        
        // Executar callback se existir
        if (onCustomerSelected) {
          onCustomerSelected(customer.id);
        }
      } else {
        setSearchError('Cliente não encontrado.');
      }
    } catch (error) {
      console.error('Erro ao buscar cliente:', error);
      setSearchError(error instanceof Error ? error.message : 'Erro ao buscar cliente');
    } finally {
      setSearchLoading(false);
    }
  };
  
  // Selecionar cliente encontrado
  const handleSelectCustomer = () => {
    if (customerFound && onCustomerSelected) {
      onCustomerSelected(customerFound.id);
    }
  };
  
  return (
    <div>
      <div className="mb-4">
        <h4>Cliente para Assinatura</h4>
        <p className="text-muted">Os dados abaixo serão usados para criar sua assinatura.</p>
      </div>
      
      {/* Formulário de busca */}
      <Card className="mb-4">
        <Card.Header>
          <h5 className="mb-0">Buscar Cliente Existente</h5>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleSearchCustomer}>
            <Form.Group className="mb-3">
              <Form.Label>CPF/CNPJ</Form.Label>
              <Form.Control
                type="text"
                value={searchCpfCnpj}
                onChange={(e) => setSearchCpfCnpj(e.target.value)}
                placeholder="Apenas números"
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>E-mail</Form.Label>
              <Form.Control
                type="email"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                placeholder="Seu e-mail cadastrado"
              />
            </Form.Group>
            
            {searchError && (
              <Alert variant="danger" className="mb-3">
                {searchError}
              </Alert>
            )}
            
            {customerFound && (
              <Alert variant="success" className="mb-3">
                <p className="mb-1"><strong>Cliente encontrado!</strong></p>
                <p className="mb-0">Nome: {customerFound.name}</p>
                <p className="mb-0">E-mail: {customerFound.email}</p>
                <p className="mb-0">CPF/CNPJ: {customerFound.cpfCnpj}</p>
                
                <div className="mt-2">
                  <Button 
                    variant="success" 
                    size="sm"
                    onClick={handleSelectCustomer}
                  >
                    Usar este cliente
                  </Button>
                </div>
              </Alert>
            )}
            
            <Button 
              variant="primary" 
              type="submit"
              disabled={searchLoading || (!searchCpfCnpj && !searchEmail)}
            >
              {searchLoading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Buscando...
                </>
              ) : 'Buscar Cliente'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
      
      {/* Formulário de criação */}
      <Card>
        <Card.Header>
          <h5 className="mb-0">Criar Novo Cliente</h5>
        </Card.Header>
        <Card.Body>
          <Form onSubmit={handleCreateCustomer}>
            <Form.Group className="mb-3">
              <Form.Label>Nome Completo*</Form.Label>
              <Form.Control
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>E-mail*</Form.Label>
              <Form.Control
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Seu e-mail"
                required
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>CPF/CNPJ*</Form.Label>
              <Form.Control
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                placeholder="Apenas números"
                required
              />
              <Form.Text className="text-muted">
                Digite apenas os números, sem pontos ou traços.
              </Form.Text>
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Telefone Celular</Form.Label>
              <Form.Control
                type="text"
                value={mobilePhone}
                onChange={(e) => setMobilePhone(e.target.value)}
                placeholder="(99) 99999-9999"
              />
              <Form.Text className="text-muted">
                Digite apenas os números, com DDD.
              </Form.Text>
            </Form.Group>
            
            {error && (
              <Alert variant="danger" className="mb-3">
                {error}
              </Alert>
            )}
            
            {customerCreated && (
              <Alert variant="success" className="mb-3">
                Cliente criado com sucesso!
              </Alert>
            )}
            
            <Button 
              variant="primary" 
              type="submit"
              disabled={loading || !name || !email || !cpfCnpj}
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Criando...
                </>
              ) : 'Criar Cliente'}
            </Button>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default CustomerForm; 