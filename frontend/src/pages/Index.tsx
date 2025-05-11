import React, { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import RoulettesDashboard from '../components/RoulettesDashboard';
import SidePanelStats from '../components/SidePanelStats';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useSubscription } from '@/context/SubscriptionContext';
import { cn } from '@/lib/utils';

export default function Index() {
  // Estado para controlar se estamos no modo de depuração
  const [debugMode, setDebugMode] = useState(false);
  // Estado para controlar a roleta selecionada
  const [selectedRoulette, setSelectedRoulette] = useState<any>(null);
  const { user } = useAuth();
  const { subscription } = useSubscription();

  // Efeito para registrar listeners de eventos e gerenciar o modo de depuração
  useEffect(() => {
    console.log('[Index] Verificando modo de depuração...');
    
    // Verificar se estamos no modo de depuração (definido por parâmetro de URL)
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug');
    
    if (debugParam === 'true') {
      console.log('[Index] Modo de depuração ativado via URL');
      setDebugMode(true);
    }
    
    // Listener para evento de atalho de teclado (Ctrl+Shift+D) para alternar modo de depuração
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setDebugMode(prev => !prev);
        console.log('[Index] Modo de depuração alterado via atalho de teclado');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Registrar listeners para eventos de roleta
    console.log('[Index] Listener para evento roleta_exists registrado');
    
    console.log('[Index] Listeners para eventos de carregamento registrados');
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Função para selecionar uma roleta e mostrar estatísticas
  const handleRouletteSelect = (roulette: any) => {
    console.log('[Index] Roleta selecionada:', roulette);
    setSelectedRoulette(roulette);
  };

  // Render padrão com layout reutilizável
  return (
    <Layout>
      <div className="container mx-auto px-4 py-6">
        {user && subscription?.active && (
          <Card className={cn(
            "bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-200 mb-6",
            "dark:from-blue-950 dark:to-indigo-950 dark:border-blue-800"
          )}>
            <CardContent className="p-4">
              <p className="text-sm">
                Bem-vindo, <span className="font-semibold">{user.firstName || user.username}</span>! 
                Você tem um plano <span className="font-semibold">{subscription.planType}</span> ativo.
              </p>
            </CardContent>
          </Card>
        )}
      
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Dashboard de roletas à esquerda */}
          <div className="w-full lg:w-2/3">
            <RoulettesDashboard onRouletteSelect={handleRouletteSelect} />
          </div>
          
          {/* Painel de estatísticas à direita */}
          <div className="w-full lg:w-1/3">
            {selectedRoulette ? (
              <SidePanelStats 
                roletaNome={selectedRoulette.nome || selectedRoulette.name || 'Roleta'}
                wins={selectedRoulette.vitorias || 0}
                losses={selectedRoulette.derrotas || 0}
              />
            ) : (
              <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 flex items-center justify-center h-48">
                <p className="text-gray-400">Selecione uma roleta para ver suas estatísticas</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Modo de depuração */}
        {debugMode && (
          <div className="mt-8 p-4 border border-amber-300 bg-amber-50 rounded-md">
            <h2 className="text-lg font-semibold text-amber-800 mb-2">Modo de Depuração</h2>
            <p className="text-sm text-amber-700 mb-4">
              Este painel só é visível no modo de depuração (Ctrl+Shift+D para alternar)
            </p>
            <div className="flex flex-wrap gap-2">
              <button 
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                onClick={() => {
                  const client = (window as any).diagnoseRouletteConnection?.();
                  console.log('Diagnóstico de conexão:', client);
                }}
              >
                Diagnóstico de Conexão
              </button>
              <button 
                className="px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                onClick={() => (window as any).forceRouletteUpdate?.()}
              >
                Forçar Reconexão
              </button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}