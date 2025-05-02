import React, { useEffect, useState } from 'react';
import { usePremiumContent } from '@/hooks/usePremiumContent';
import { useSubscription } from '@/hooks/useSubscription';
import PremiumContent from './PremiumContent';
import BlurredPremiumContent from './BlurredPremiumContent';
import { PlanType } from '@/types/plans';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { LockKeyhole, Sparkles, Info, BarChart3 } from 'lucide-react';

/**
 * Componente de demonstração dos recursos premium com diferentes níveis de acesso
 */
const ExemploPremiumContent = () => {
  const { currentPlan } = useSubscription();
  const [tab, setTab] = useState('blur');

  // Utilizar hook de conteúdo premium para buscar dados de estatísticas
  const { 
    data: estatisticas, 
    loading: estatisticasLoading, 
    error: estatisticasError,
    hasAccess: temAcessoEstatisticas,
    fetchData: buscarEstatisticas
  } = usePremiumContent<any>({
    featureId: 'view_advanced_stats',
    requiredPlan: PlanType.PRO,
    endpoint: '/api/premium/content/stats',
    fetchOnMount: true
  });

  // Utilizar hook para recomendações (outro recurso premium)
  const {
    data: recomendacoes,
    loading: recomendacoesLoading,
    hasAccess: temAcessoRecomendacoes,
    fetchData: buscarRecomendacoes
  } = usePremiumContent<any[]>({
    featureId: 'ai_predictions',
    requiredPlan: PlanType.PREMIUM,
    endpoint: '/api/premium/content/recommendations',
    fetchOnMount: true
  });

  // Buscar dados quando o componente é montado
  useEffect(() => {
    if (!estatisticas && !estatisticasLoading) {
      buscarEstatisticas();
    }
    
    if (!recomendacoes && !recomendacoesLoading) {
      buscarRecomendacoes();
    }
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold text-vegas-gold mb-6 flex items-center">
        <Sparkles className="w-6 h-6 mr-2" /> Demonstração de Conteúdo Premium
      </h1>

      {/* Informação do plano atual */}
      <Card className="mb-8 bg-vegas-darkgray border-gray-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-vegas-gold/10 flex items-center justify-center">
              <Info className="w-6 h-6 text-vegas-gold" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">
                Seu plano atual: {currentPlan?.name || 'Free'}
              </h3>
              <p className="text-sm text-gray-400">
                {currentPlan?.type === PlanType.FREE
                  ? 'Você está usando a versão gratuita. Faça upgrade para acessar recursos premium.'
                  : `Você tem acesso a ${currentPlan?.allowedFeatures.length || 0} recursos premium.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Tabs para demonstrar diferentes tipos de proteção */}
      <Tabs 
        defaultValue="blur" 
        className="mb-8" 
        value={tab} 
        onValueChange={setTab}
      >
        <TabsList className="grid grid-cols-3 mb-6">
          <TabsTrigger value="blur">Conteúdo borrado</TabsTrigger>
          <TabsTrigger value="placeholder">Placeholder</TabsTrigger>
          <TabsTrigger value="fallback">Versão degradada</TabsTrigger>
        </TabsList>
        
        {/* Tab de conteúdo com blur */}
        <TabsContent value="blur">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráficos com blur */}
            <Card className="border-gray-700 bg-[#161A26]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-vegas-gold" /> 
                  Estatísticas Premium
                </CardTitle>
                <CardDescription>
                  Visualização detalhada disponível para planos Pro e Premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BlurredPremiumContent
                  featureId="view_advanced_stats"
                  requiredPlan={PlanType.PRO}
                  blurIntensity={6}
                  message="Estatísticas detalhadas disponíveis apenas para assinantes Pro e Premium."
                >
                  {/* Conteúdo que seria mostrado apenas para usuários premium */}
                  <div className="space-y-4">
                    <div className="bg-[#252A36] rounded-lg p-4">
                      <h3 className="text-vegas-gold font-medium mb-2">Resumo de performance</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-white">1295</div>
                          <div className="text-xs text-gray-400">Total</div>
                        </div>
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-white">259</div>
                          <div className="text-xs text-gray-400">Média</div>
                        </div>
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-green-500">+24%</div>
                          <div className="text-xs text-gray-400">Crescimento</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Gráfico de barras simulado */}
                    <div className="bg-[#252A36] rounded-lg p-4">
                      <h3 className="text-sm text-gray-400 mb-3">Desempenho por dia</h3>
                      <div className="flex items-end h-32 gap-1">
                        <div className="flex-1 bg-vegas-gold h-[30%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[55%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[45%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[80%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[95%] rounded-t-sm"></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <div>01/01</div>
                        <div>02/01</div>
                        <div>03/01</div>
                        <div>04/01</div>
                        <div>05/01</div>
                      </div>
                    </div>
                  </div>
                </BlurredPremiumContent>
              </CardContent>
            </Card>
            
            {/* Recomendações com blur */}
            <Card className="border-gray-700 bg-[#161A26]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-vegas-gold" /> 
                  Recomendações IA
                </CardTitle>
                <CardDescription>
                  Sugestões avançadas disponíveis apenas no plano Premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BlurredPremiumContent
                  featureId="ai_predictions"
                  requiredPlan={PlanType.PREMIUM}
                  blurIntensity={6}
                  message="Recomendações da IA disponíveis apenas para assinantes Premium."
                >
                  <div className="space-y-3">
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 1</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          95% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Dados exclusivos com análise preditiva baseada nos padrões recentes
                      </p>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 2</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          88% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Análise profunda dos últimos 200 resultados com padrões identificados
                      </p>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 3</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          82% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Predição baseada em modelo de machine learning proprietário
                      </p>
                    </div>
                  </div>
                </BlurredPremiumContent>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Tab de placeholder */}
        <TabsContent value="placeholder">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Gráficos com placeholder */}
            <Card className="border-gray-700 bg-[#161A26]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-vegas-gold" /> 
                  Estatísticas Premium
                </CardTitle>
                <CardDescription>
                  Visualização detalhada disponível para planos Pro e Premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PremiumContent
                  featureId="view_advanced_stats"
                  requiredPlan={PlanType.PRO}
                  nonPremiumView="placeholder"
                  upgradeMessage="Acesse estatísticas detalhadas fazendo upgrade para o plano Pro ou superior."
                >
                  {/* Conteúdo premium */}
                  <div className="space-y-4">
                    <div className="bg-[#252A36] rounded-lg p-4">
                      <h3 className="text-vegas-gold font-medium mb-2">Resumo de performance</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-white">1295</div>
                          <div className="text-xs text-gray-400">Total</div>
                        </div>
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-white">259</div>
                          <div className="text-xs text-gray-400">Média</div>
                        </div>
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-green-500">+24%</div>
                          <div className="text-xs text-gray-400">Crescimento</div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Gráfico de barras simulado */}
                    <div className="bg-[#252A36] rounded-lg p-4">
                      <h3 className="text-sm text-gray-400 mb-3">Desempenho por dia</h3>
                      <div className="flex items-end h-32 gap-1">
                        <div className="flex-1 bg-vegas-gold h-[30%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[55%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[45%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[80%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[95%] rounded-t-sm"></div>
                      </div>
                      <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <div>01/01</div>
                        <div>02/01</div>
                        <div>03/01</div>
                        <div>04/01</div>
                        <div>05/01</div>
                      </div>
                    </div>
                  </div>
                </PremiumContent>
              </CardContent>
            </Card>
            
            {/* Recomendações com placeholder */}
            <Card className="border-gray-700 bg-[#161A26]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-vegas-gold" /> 
                  Recomendações IA
                </CardTitle>
                <CardDescription>
                  Sugestões avançadas disponíveis apenas no plano Premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PremiumContent
                  featureId="ai_predictions"
                  requiredPlan={PlanType.PREMIUM}
                  nonPremiumView="hidden"
                  upgradeMessage="Recomendações de IA com alta precisão disponíveis apenas no plano Premium."
                >
                  <div className="space-y-3">
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 1</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          95% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Dados exclusivos com análise preditiva baseada nos padrões recentes
                      </p>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 2</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          88% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Análise profunda dos últimos 200 resultados com padrões identificados
                      </p>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 3</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          82% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Predição baseada em modelo de machine learning proprietário
                      </p>
                    </div>
                  </div>
                </PremiumContent>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        {/* Tab de versão degradada */}
        <TabsContent value="fallback">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Versão degradada das estatísticas */}
            <Card className="border-gray-700 bg-[#161A26]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-vegas-gold" /> 
                  Estatísticas (Versão Limitada)
                </CardTitle>
                <CardDescription>
                  Versão básica para usuários não-premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PremiumContent
                  featureId="view_advanced_stats"
                  requiredPlan={PlanType.PRO}
                  nonPremiumView="fallback"
                  fallbackContent={
                    <div className="space-y-4">
                      <div className="bg-[#252A36] rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-vegas-gold font-medium">Resumo básico</h3>
                          <div className="rounded px-2 py-1 text-xs bg-gray-700 text-gray-300 flex items-center">
                            <LockKeyhole className="w-3 h-3 mr-1" /> Versão limitada
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3 mt-3">
                          <div className="bg-[#1D2130] p-3 rounded-md">
                            <div className="text-2xl font-bold text-white">10+</div>
                            <div className="text-xs text-gray-400">Estatísticas disponíveis na versão completa</div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
                        <LockKeyhole className="w-10 h-10 mx-auto mb-3 text-gray-500" />
                        <h3 className="text-sm text-gray-400 mb-3">
                          Faça upgrade para o plano Pro e tenha acesso a estatísticas detalhadas, 
                          gráficos e análises avançadas
                        </h3>
                        <Button className="bg-vegas-gold hover:bg-vegas-gold/80 text-black">
                          Fazer Upgrade
                        </Button>
                      </div>
                    </div>
                  }
                >
                  {/* Conteúdo premium (o mesmo da primeira tab) */}
                  <div className="space-y-4">
                    <div className="bg-[#252A36] rounded-lg p-4">
                      <h3 className="text-vegas-gold font-medium mb-2">Resumo de performance</h3>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-white">1295</div>
                          <div className="text-xs text-gray-400">Total</div>
                        </div>
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-white">259</div>
                          <div className="text-xs text-gray-400">Média</div>
                        </div>
                        <div className="bg-[#1D2130] p-3 rounded-md">
                          <div className="text-2xl font-bold text-green-500">+24%</div>
                          <div className="text-xs text-gray-400">Crescimento</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-4">
                      <h3 className="text-sm text-gray-400 mb-3">Desempenho por dia</h3>
                      <div className="flex items-end h-32 gap-1">
                        <div className="flex-1 bg-vegas-gold h-[30%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[55%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[45%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[80%] rounded-t-sm"></div>
                        <div className="flex-1 bg-vegas-gold h-[95%] rounded-t-sm"></div>
                      </div>
                    </div>
                  </div>
                </PremiumContent>
              </CardContent>
            </Card>
            
            {/* Versão degradada das recomendações */}
            <Card className="border-gray-700 bg-[#161A26]">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-vegas-gold" /> 
                  Recomendações IA (Versão Demo)
                </CardTitle>
                <CardDescription>
                  Prévia para usuários não-premium
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PremiumContent
                  featureId="ai_predictions"
                  requiredPlan={PlanType.PREMIUM}
                  nonPremiumView="fallback"
                  allowPeek={true}
                  fallbackContent={
                    <div className="space-y-3">
                      <div className="flex items-center mb-2">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium">Versão demo limitada</h3>
                          <p className="text-xs text-gray-500">Mostrando 1 de 7 recomendações</p>
                        </div>
                        <LockKeyhole className="w-4 h-4 text-gray-500" />
                      </div>
                      
                      <div className="bg-[#252A36] rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <h3 className="text-white font-medium">Recomendação (Demo)</h3>
                          <div className="px-2 py-1 rounded-full text-xs bg-gray-700 text-gray-300">
                            Demo
                          </div>
                        </div>
                        <p className="text-sm text-gray-400 mt-1">
                          Versão de demonstração com dados simplificados
                        </p>
                      </div>
                      
                      <div className="bg-[#1D1F2A] border border-dashed border-gray-700 rounded-lg p-4 mt-4 text-center">
                        <h3 className="text-sm font-medium text-gray-300 mb-2">
                          As recomendações completas incluem:
                        </h3>
                        <ul className="text-xs text-gray-400 text-left mb-3">
                          <li className="flex items-center">
                            <span className="mr-1 text-vegas-gold">✓</span> 
                            Análise de padrões avançada
                          </li>
                          <li className="flex items-center">
                            <span className="mr-1 text-vegas-gold">✓</span> 
                            7 sugestões detalhadas com alta precisão
                          </li>
                          <li className="flex items-center">
                            <span className="mr-1 text-vegas-gold">✓</span> 
                            Atualização em tempo real
                          </li>
                        </ul>
                        <Button size="sm" className="bg-vegas-gold hover:bg-vegas-gold/80 text-black">
                          Upgrade para Premium
                        </Button>
                      </div>
                    </div>
                  }
                >
                  {/* Conteúdo premium (o mesmo da primeira tab) */}
                  <div className="space-y-3">
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 1</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          95% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Dados exclusivos com análise preditiva baseada nos padrões recentes
                      </p>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 2</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          88% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Análise profunda dos últimos 200 resultados com padrões identificados
                      </p>
                    </div>
                    
                    <div className="bg-[#252A36] rounded-lg p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="text-white font-medium">Recomendação Premium 3</h3>
                        <div className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
                          82% confiança
                        </div>
                      </div>
                      <p className="text-sm text-gray-400 mt-1">
                        Predição baseada em modelo de machine learning proprietário
                      </p>
                    </div>
                  </div>
                </PremiumContent>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExemploPremiumContent; 