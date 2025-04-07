import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { toast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import config from '@/config/env';

// Mapeamento de IDs para nomes amigáveis
const ROULETTE_NAMES: Record<string, string> = {
  "2010016": "Immersive Roulette",
  "2380335": "Brazilian Mega Roulette",
  "2010065": "Bucharest Auto-Roulette",
  "2010096": "Speed Auto Roulette",
  "2010017": "Ruleta Automática",
  "2010098": "Auto-Roulette VIP",
  "2380038": "Lightning Roulette", // Nome exemplo, ajuste conforme necessário
  "2380010": "Auto Roulette 10"    // Nome exemplo, ajuste conforme necessário
};

const AdminConfigPage: React.FC = () => {
  const [allowedRoulettes, setAllowedRoulettes] = useState<string[]>([]);
  const [newRouletteId, setNewRouletteId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Carregar a lista de roletas permitidas ao iniciar
  useEffect(() => {
    fetchAllowedRoulettes();
  }, []);
  
  // Buscar a lista atual de roletas permitidas
  const fetchAllowedRoulettes = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const apiUrl = `${config.apiBaseUrl}/config/allowed-roulettes`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`Erro ao buscar roletas permitidas: ${response.status}`);
      }
      
      const data = await response.json();
      setAllowedRoulettes(data.allowedRoulettes || []);
    } catch (err) {
      setError(`Falha ao carregar a configuração: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Erro ao buscar roletas permitidas:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Salvar alterações
  const saveAllowedRoulettes = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    
    try {
      const apiUrl = `${config.apiBaseUrl}/config/allowed-roulettes`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ allowedRoulettes })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao salvar roletas permitidas: ${response.status}`);
      }
      
      const data = await response.json();
      setSuccess(`Configuração salva com sucesso! ${data.totalCount} roletas configuradas.`);
      
      toast({
        title: "Configuração salva",
        description: `Roletas permitidas atualizadas com sucesso.`,
        variant: "default"
      });
    } catch (err) {
      setError(`Falha ao salvar a configuração: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Erro ao salvar roletas permitidas:', err);
      
      toast({
        title: "Erro",
        description: `Falha ao salvar a configuração: ${err instanceof Error ? err.message : String(err)}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };
  
  // Adicionar uma nova roleta
  const addRoulette = () => {
    const id = newRouletteId.trim();
    if (!id) return;
    
    if (allowedRoulettes.includes(id)) {
      toast({
        title: "Aviso",
        description: "Esta roleta já está na lista de permitidas.",
        variant: "default"
      });
      return;
    }
    
    setAllowedRoulettes([...allowedRoulettes, id]);
    setNewRouletteId('');
    
    toast({
      title: "Roleta adicionada",
      description: `ID ${id} adicionado à lista.`,
      variant: "default"
    });
  };
  
  // Remover uma roleta
  const removeRoulette = (id: string) => {
    setAllowedRoulettes(allowedRoulettes.filter(roulette => roulette !== id));
    
    toast({
      title: "Roleta removida",
      description: `ID ${id} removido da lista.`,
      variant: "default"
    });
  };
  
  // Obter nome amigável para uma roleta
  const getRouletteName = (id: string): string => {
    return ROULETTE_NAMES[id] || `Roleta ${id}`;
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Configuração de Roletas</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Roletas Permitidas</CardTitle>
          <CardDescription>
            Configure quais roletas serão exibidas no sistema. As alterações serão aplicadas em tempo real no scraper.
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          {success && (
            <Alert className="mb-4">
              <AlertTitle>Sucesso</AlertTitle>
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center space-x-2 mb-6">
            <Input
              placeholder="ID da roleta (ex: 2010016)"
              value={newRouletteId}
              onChange={(e) => setNewRouletteId(e.target.value)}
              className="flex-1"
            />
            <Button onClick={addRoulette}>Adicionar</Button>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allowedRoulettes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center">Nenhuma roleta configurada</TableCell>
                  </TableRow>
                ) : (
                  allowedRoulettes.map((id) => (
                    <TableRow key={id}>
                      <TableCell className="font-mono">{id}</TableCell>
                      <TableCell>{getRouletteName(id)}</TableCell>
                      <TableCell>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => removeRoulette(id)}
                        >
                          Remover
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
        
        <CardFooter className="flex justify-end">
          <Button 
            onClick={saveAllowedRoulettes} 
            disabled={saving || loading}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <h3 className="font-bold mb-2">Instruções:</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>Adicione ou remova IDs de roletas conforme necessário</li>
          <li>Clique em "Salvar Alterações" para aplicar as mudanças</li>
          <li>As alterações serão aplicadas em tempo real, sem necessidade de reiniciar o sistema</li>
          <li>Os IDs das roletas são números como: 2010016, 2380335, etc.</li>
        </ul>
      </div>
    </div>
  );
};

export default AdminConfigPage; 