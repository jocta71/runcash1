import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import StrategyService, { Strategy } from '@/services/StrategyService';

// Interface para as configurações de regras
interface StrategyRules {
  detectarRepeticoes: boolean;
  verificarParidade: boolean;
  verificarCores: boolean;
  analisarDezenas: boolean;
  analisarColunas: boolean;
}

// Interface para as configurações de terminais
interface TerminalsConfig {
  useDefaultTerminals: boolean;
  customTerminals: number[];
}

const StrategyFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = !!id;
  
  // Estado para os campos do formulário
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  
  // Estado para as regras da estratégia
  const [rules, setRules] = useState<StrategyRules>({
    detectarRepeticoes: true,
    verificarParidade: false,
    verificarCores: false,
    analisarDezenas: false,
    analisarColunas: false,
  });
  
  // Estado para configuração de terminais
  const [terminalsConfig, setTerminalsConfig] = useState<TerminalsConfig>({
    useDefaultTerminals: true,
    customTerminals: []
  });
  
  // Estado para terminais personalizados
  const [customTerminalInput, setCustomTerminalInput] = useState('');
  
  // Carregar dados existentes para edição
  useEffect(() => {
    if (isEditMode && id) {
      const loadStrategy = async () => {
        try {
          const strategy = await StrategyService.getStrategy(id);
          if (strategy) {
            setName(strategy.name);
            setDescription(strategy.description || '');
            setIsPublic(strategy.isPublic);
            setRules(strategy.rules as StrategyRules);
            setTerminalsConfig(strategy.terminalsConfig);
          }
        } catch (error) {
          console.error('Erro ao carregar estratégia:', error);
          toast.error('Não foi possível carregar os dados da estratégia');
        } finally {
          setInitialLoading(false);
        }
      };
      
      loadStrategy();
    } else {
      setInitialLoading(false);
    }
  }, [id, isEditMode]);
  
  // Atualizar uma regra específica
  const handleRuleChange = (rule: keyof StrategyRules, value: boolean) => {
    setRules(prev => ({
      ...prev,
      [rule]: value
    }));
  };
  
  // Alternar entre usar terminais padrão ou personalizados
  const handleTerminalConfigChange = (useDefault: boolean) => {
    setTerminalsConfig(prev => ({
      ...prev,
      useDefaultTerminals: useDefault
    }));
  };
  
  // Adicionar um terminal personalizado
  const handleAddCustomTerminal = () => {
    const terminal = parseInt(customTerminalInput);
    if (isNaN(terminal) || terminal < 0 || terminal > 9) {
      toast.error('Terminal deve ser um número entre 0 e 9');
      return;
    }
    
    if (terminalsConfig.customTerminals.includes(terminal)) {
      toast.error('Este terminal já foi adicionado');
      return;
    }
    
    setTerminalsConfig(prev => ({
      ...prev,
      customTerminals: [...prev.customTerminals, terminal].sort((a, b) => a - b)
    }));
    
    setCustomTerminalInput('');
  };
  
  // Remover um terminal personalizado
  const handleRemoveCustomTerminal = (terminal: number) => {
    setTerminalsConfig(prev => ({
      ...prev,
      customTerminals: prev.customTerminals.filter(t => t !== terminal)
    }));
  };
  
  // Enviar o formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('O nome da estratégia é obrigatório');
      return;
    }
    
    // Verificar se pelo menos uma regra está selecionada
    const hasRule = Object.values(rules).some(value => value === true);
    if (!hasRule) {
      toast.error('Selecione pelo menos uma regra para a estratégia');
      return;
    }
    
    // Verificar se há terminais personalizados quando a opção está ativada
    if (!terminalsConfig.useDefaultTerminals && terminalsConfig.customTerminals.length === 0) {
      toast.error('Adicione pelo menos um terminal personalizado ou use os terminais padrão');
      return;
    }
    
    setLoading(true);
    
    try {
      const strategyData = {
        name,
        description,
        isPublic,
        rules,
        terminalsConfig
      };
      
      let result;
      if (isEditMode && id) {
        result = await StrategyService.updateStrategy(id, strategyData);
        if (result) {
          toast.success('Estratégia atualizada com sucesso');
        }
      } else {
        result = await StrategyService.createStrategy(strategyData);
        if (result) {
          toast.success('Estratégia criada com sucesso');
        }
      }
      
      if (result) {
        navigate('/strategies');
      } else {
        toast.error('Erro ao salvar estratégia');
      }
    } catch (error) {
      console.error('Erro ao salvar estratégia:', error);
      toast.error('Erro ao salvar estratégia');
    } finally {
      setLoading(false);
    }
  };
  
  if (initialLoading) {
    return (
      <div className="container mx-auto py-8 flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6 flex items-center">
        <Button variant="ghost" onClick={() => navigate('/strategies')} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditMode ? 'Editar Estratégia' : 'Nova Estratégia'}
        </h1>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>Defina o nome e descrição da sua estratégia</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Estratégia *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Estratégia de Colunas"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descreva como a estratégia funciona..."
                    rows={4}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch 
                    id="isPublic" 
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                  <Label htmlFor="isPublic">Tornar esta estratégia pública</Label>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Regras da Estratégia</CardTitle>
                <CardDescription>Selecione quais regras a estratégia irá usar para detectar padrões</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="detectarRepeticoes"
                      checked={rules.detectarRepeticoes}
                      onCheckedChange={(checked) => 
                        handleRuleChange('detectarRepeticoes', checked === true)
                      }
                    />
                    <div>
                      <Label htmlFor="detectarRepeticoes" className="font-medium">Detectar Repetições</Label>
                      <p className="text-sm text-gray-500">Detecta quando números se repetem em sequência</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verificarParidade"
                      checked={rules.verificarParidade}
                      onCheckedChange={(checked) => 
                        handleRuleChange('verificarParidade', checked === true)
                      }
                    />
                    <div>
                      <Label htmlFor="verificarParidade" className="font-medium">Verificar Paridade</Label>
                      <p className="text-sm text-gray-500">Analisa sequências de números pares e ímpares</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="verificarCores"
                      checked={rules.verificarCores}
                      onCheckedChange={(checked) => 
                        handleRuleChange('verificarCores', checked === true)
                      }
                    />
                    <div>
                      <Label htmlFor="verificarCores" className="font-medium">Verificar Cores</Label>
                      <p className="text-sm text-gray-500">Analisa padrões de cores (vermelho/preto)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="analisarDezenas"
                      checked={rules.analisarDezenas}
                      onCheckedChange={(checked) => 
                        handleRuleChange('analisarDezenas', checked === true)
                      }
                    />
                    <div>
                      <Label htmlFor="analisarDezenas" className="font-medium">Analisar Dezenas</Label>
                      <p className="text-sm text-gray-500">Analisa grupos de dezenas (1-12, 13-24, 25-36)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="analisarColunas"
                      checked={rules.analisarColunas}
                      onCheckedChange={(checked) => 
                        handleRuleChange('analisarColunas', checked === true)
                      }
                    />
                    <div>
                      <Label htmlFor="analisarColunas" className="font-medium">Analisar Colunas</Label>
                      <p className="text-sm text-gray-500">Analisa padrões em colunas da roleta</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Configuração de Terminais</CardTitle>
                <CardDescription>Defina como os terminais serão calculados</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="useDefaultTerminals" 
                      checked={terminalsConfig.useDefaultTerminals}
                      onCheckedChange={handleTerminalConfigChange}
                    />
                    <Label htmlFor="useDefaultTerminals">Usar terminais padrão do sistema</Label>
                  </div>
                  
                  {!terminalsConfig.useDefaultTerminals && (
                    <div className="space-y-4">
                      <div className="flex space-x-2">
                        <Input
                          value={customTerminalInput}
                          onChange={(e) => setCustomTerminalInput(e.target.value)}
                          placeholder="Terminal (0-9)"
                          maxLength={1}
                          className="w-24"
                        />
                        <Button 
                          type="button" 
                          variant="secondary" 
                          onClick={handleAddCustomTerminal}
                        >
                          Adicionar
                        </Button>
                      </div>
                      
                      {terminalsConfig.customTerminals.length > 0 && (
                        <div>
                          <Label className="mb-2 block">Terminais Selecionados:</Label>
                          <div className="flex flex-wrap gap-2">
                            {terminalsConfig.customTerminals.map(terminal => (
                              <div 
                                key={terminal}
                                className="bg-secondary text-secondary-foreground px-3 py-1 rounded-full flex items-center"
                              >
                                <span className="mr-1">{terminal}</span>
                                <button
                                  type="button"
                                  className="text-xs text-secondary-foreground/60 hover:text-secondary-foreground"
                                  onClick={() => handleRemoveCustomTerminal(terminal)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Salvar Estratégia</CardTitle>
                <CardDescription>
                  {isEditMode 
                    ? 'Atualize a sua estratégia com as novas configurações' 
                    : 'Crie sua estratégia personalizada para roletas'}
                </CardDescription>
              </CardHeader>
              <CardFooter>
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {isEditMode ? 'Atualizando...' : 'Criando...'}
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      {isEditMode ? 'Atualizar Estratégia' : 'Criar Estratégia'}
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
};

export default StrategyFormPage; 