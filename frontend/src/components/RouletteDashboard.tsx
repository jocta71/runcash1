import React, { useEffect, useState } from 'react';
import { useSubscription } from '@/context/SubscriptionContext';
import EventService from '@/services/EventService';
import { RouletteEvent } from '@/services/EventService';
import PremiumContent from '@/components/PremiumContent';
import { SOCKET_FEATURES } from '@/services/EventService';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';

interface RouletteDashboardProps {
  roletaNome: string;
  showHistory?: boolean;
}

const RouletteDashboard: React.FC<RouletteDashboardProps> = ({ roletaNome, showHistory = true }) => {
  const [numeros, setNumeros] = useState<number[]>([]);
  const [updateCounter, setUpdateCounter] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const { currentPlan } = useSubscription();
  
  // Usar o hook para verificar acesso a recursos premium
  const { 
    hasAccess,
    hasPaidPlan,
    redirectToPlanPage
  } = useFeatureAccess({
    featureId: SOCKET_FEATURES.REAL_TIME_DATA,
    redirectToPlans: false
  });
  
  // Inscrever-se para eventos
  useEffect(() => {
    // Função para manipular eventos de roleta
    const handleRouletteEvent = (event: RouletteEvent) => {
      if (event.type === 'new_number') {
        // Adicionar o novo número ao início do array
        setNumeros(prev => [event.numero, ...prev.slice(0, 19)]);
        setUpdateCounter(c => c + 1);
        setLastUpdate(new Date());
      }
    };
    
    // Registrar o listener no serviço
    EventService.subscribe(roletaNome, handleRouletteEvent);
    
    // Limpar o listener ao desmontar
    return () => {
      EventService.unsubscribe(roletaNome, handleRouletteEvent);
    };
  }, [roletaNome]);
  
  // Renderizar o conteúdo do dashboard
  return (
    <div className="bg-background rounded-lg shadow-md p-4">
      <h2 className="text-xl font-semibold mb-4">{roletaNome}</h2>
      
      {/* Painel principal com dados em tempo real - Protegido para usuários premium */}
      <PremiumContent 
        featureId={SOCKET_FEATURES.REAL_TIME_DATA}
        upgradeMessage="Receba atualizações em tempo real da roleta com o plano Premium"
        nonPremiumView="blur"
        allowPeek={true}
      >
        <div className="grid grid-cols-2 gap-4">
          {/* Painel de estatísticas em tempo real */}
          <div className="bg-black/5 rounded p-3">
            <h3 className="text-sm font-medium mb-2">Últimas atualizações</h3>
            <div className="flex space-x-1">
              {numeros.slice(0, 10).map((numero, idx) => (
                <div 
                  key={idx} 
                  className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold
                    ${numero === 0 ? 'bg-green-500 text-white' : 
                      [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero) 
                        ? 'bg-red-600 text-white' 
                        : 'bg-black text-white'}`}
                >
                  {numero}
                </div>
              ))}
            </div>
            <p className="text-xs mt-3 text-muted-foreground">
              Última atualização: {lastUpdate ? new Date(lastUpdate).toLocaleTimeString() : 'Aguardando...'}
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              Total de atualizações: {updateCounter}
            </p>
          </div>
          
          {/* Estatísticas básicas */}
          <div className="bg-black/5 rounded p-3">
            <h3 className="text-sm font-medium mb-2">Estatísticas</h3>
            {numeros.length > 0 ? (
              <ul className="text-xs space-y-1">
                <li>Números vermelhos: {numeros.filter(n => [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}</li>
                <li>Números pretos: {numeros.filter(n => ![0, 1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(n)).length}</li>
                <li>Zeros: {numeros.filter(n => n === 0).length}</li>
                <li>Pares: {numeros.filter(n => n !== 0 && n % 2 === 0).length}</li>
                <li>Ímpares: {numeros.filter(n => n % 2 !== 0).length}</li>
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Aguardando dados...</p>
            )}
          </div>
        </div>
        
        {/* Histórico completo (opcional) */}
        {showHistory && (
          <div className="mt-4 bg-black/5 rounded p-3">
            <h3 className="text-sm font-medium mb-2">Histórico Completo</h3>
            <div className="flex flex-wrap gap-1">
              {numeros.map((numero, idx) => (
                <div 
                  key={idx} 
                  className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                    ${numero === 0 ? 'bg-green-500 text-white' : 
                      [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(numero) 
                        ? 'bg-red-600 text-white' 
                        : 'bg-black text-white'}`}
                >
                  {numero}
                </div>
              ))}
              {numeros.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum dado registrado ainda</p>
              )}
            </div>
          </div>
        )}
      </PremiumContent>
      
      {/* Botão de upgrade para planos (visível apenas para usuários sem plano pago) */}
      {!hasPaidPlan && (
        <div className="mt-4">
          <Button 
            onClick={redirectToPlanPage}
            className="w-full bg-gradient-to-r from-yellow-400 to-amber-600 text-black font-medium hover:from-yellow-500 hover:to-amber-700"
          >
            Fazer Upgrade para Dados em Tempo Real
          </Button>
        </div>
      )}
    </div>
  );
};

export default RouletteDashboard; 