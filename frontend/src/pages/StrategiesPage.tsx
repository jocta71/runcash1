import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import StrategyService, { Strategy } from '@/services/StrategyService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const StrategiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [strategyToDelete, setStrategyToDelete] = useState<Strategy | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Minhas Estratégias</h1>
        <Button onClick={navigateToCreateStrategy}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Estratégia
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Carregando estratégias...</span>
        </div>
      ) : strategies.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-10">
              <p className="text-muted-foreground mb-4">
                Você ainda não criou nenhuma estratégia.
              </p>
              <Button onClick={navigateToCreateStrategy}>
                Criar minha primeira estratégia
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <Card key={strategy._id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{strategy.name}</CardTitle>
                  <div className="flex space-x-1">
                    {strategy.isSystem && (
                      <Badge variant="secondary" className="bg-blue-500 text-white">Sistema</Badge>
                    )}
                    {strategy.isPublic && (
                      <Badge variant="secondary" className="bg-green-500 text-white">Pública</Badge>
                    )}
                  </div>
                </div>
                {strategy.description && (
                  <CardDescription className="text-sm line-clamp-2">{strategy.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-sm text-muted-foreground">
                  <div className="mb-1">
                    <span className="font-medium">Regras:</span> {Object.keys(strategy.rules).length} configuradas
                  </div>
                  <div>
                    <span className="font-medium">Terminais:</span> {
                      strategy.terminalsConfig.useDefaultTerminals 
                        ? 'Padrão do sistema' 
                        : strategy.terminalsConfig.customTerminals.length > 0 
                          ? strategy.terminalsConfig.customTerminals.join(', ') 
                          : 'Nenhum configurado'
                    }
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex justify-between">
                <div className="space-x-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => navigateToViewStrategy(strategy._id)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Ver
                  </Button>
                  {!strategy.isSystem && (
                    <>
                      <Button 
                        size="sm"
                        variant="ghost"
                        onClick={() => navigateToEditStrategy(strategy._id)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(strategy)}
                      >
                        <Trash className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </>
                  )}
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

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