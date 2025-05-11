import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StrategyService, { Strategy } from '@/services/StrategyService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash, Eye, Search, FilterX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const StrategiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState<Strategy | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async () => {
    setLoading(true);
    try {
      const strategies = await StrategyService.getStrategies();
      setStrategies(strategies);
    } catch (error) {
      console.error('Erro ao carregar estratégias:', error);
      toast.error('Não foi possível carregar as estratégias');
    } finally {
      setLoading(false);
    }
  };

  const openDeleteDialog = (strategy: Strategy) => {
    setStrategyToDelete(strategy);
    setDeleteDialogOpen(true);
  };

  const handleDeleteStrategy = async () => {
    if (!strategyToDelete) return;
    
    setDeleting(true);
    try {
      const success = await StrategyService.deleteStrategy(strategyToDelete._id);
      if (success) {
        setStrategies(strategies.filter(s => s._id !== strategyToDelete._id));
        toast.success('Estratégia excluída com sucesso');
      } else {
        toast.error('Erro ao excluir estratégia');
      }
    } catch (error) {
      console.error('Erro ao excluir estratégia:', error);
      toast.error('Erro ao excluir estratégia');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setStrategyToDelete(null);
    }
  };

  const navigateToCreateStrategy = () => {
    navigate('/strategies/create');
  };

  const navigateToEditStrategy = (id: string) => {
    navigate(`/strategies/edit/${id}`);
  };

  const navigateToViewStrategy = (id: string) => {
    navigate(`/strategies/view/${id}`);
  };

  const filteredStrategies = strategies.filter(strategy => {
    // Filtrar com base na pesquisa
    const matchesSearch = searchTerm === '' || 
      strategy.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (strategy.description && strategy.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtrar com base na aba ativa
    if (activeTab === 'all') {
      return matchesSearch;
    } else if (activeTab === 'system') {
      return matchesSearch && strategy.isSystem;
    } else if (activeTab === 'custom') {
      return matchesSearch && !strategy.isSystem;
    } else if (activeTab === 'public') {
      return matchesSearch && strategy.isPublic;
    }
    
    return matchesSearch;
  });

  return (
    <div className="container mx-auto py-6">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Estratégias</h1>
          <Button onClick={navigateToCreateStrategy} size="sm" className="md:self-end">
            <Plus className="mr-2 h-4 w-4" />
            Nova Estratégia
          </Button>
        </div>

        <div className="bg-card rounded-lg border shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar estratégias..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              {searchTerm && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchTerm('')}
                >
                  <FilterX className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="system">Sistema</TabsTrigger>
              <TabsTrigger value="custom">Personalizadas</TabsTrigger>
              <TabsTrigger value="public">Públicas</TabsTrigger>
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Carregando estratégias...</span>
            </div>
          ) : filteredStrategies.length === 0 ? (
            <div className="bg-muted/30 rounded-lg p-8 text-center">
              {searchTerm ? (
                <div>
                  <p className="text-muted-foreground">Nenhuma estratégia encontrada para "{searchTerm}"</p>
                  <Button variant="link" onClick={() => setSearchTerm('')}>Limpar filtro</Button>
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-4">Você ainda não criou nenhuma estratégia.</p>
                  <Button onClick={navigateToCreateStrategy}>
                    Criar minha primeira estratégia
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStrategies.map((strategy) => (
                <Card key={strategy._id} className="hover:shadow-md transition-shadow overflow-hidden border border-muted">
                  <CardHeader className="px-6 py-4 pb-2 bg-muted/10">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg font-medium">{strategy.name}</CardTitle>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {strategy.isSystem && (
                          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">Sistema</Badge>
                        )}
                        {strategy.isPublic && (
                          <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">Pública</Badge>
                        )}
                      </div>
                    </div>
                    {strategy.description && (
                      <CardDescription className="mt-2 line-clamp-2">{strategy.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="px-6 py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Regras:</span>
                        <span className="font-medium">{Object.keys(strategy.rules).length} configuradas</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Terminais:</span>
                        <span className="font-medium">{
                          strategy.terminalsConfig.useDefaultTerminals 
                            ? 'Padrão do sistema' 
                            : strategy.terminalsConfig.customTerminals.length > 0 
                              ? `${strategy.terminalsConfig.customTerminals.length} configurados` 
                              : 'Nenhum'
                        }</span>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-between items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => navigateToViewStrategy(strategy._id)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Visualizar
                      </Button>
                      
                      {!strategy.isSystem && (
                        <div className="flex gap-2 flex-1">
                          <Button 
                            size="sm"
                            variant="outline"
                            onClick={() => navigateToEditStrategy(strategy._id)}
                            className="flex-1"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openDeleteDialog(strategy)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir a estratégia "{strategyToDelete?.name}"? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteStrategy}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>Excluir</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StrategiesPage; 