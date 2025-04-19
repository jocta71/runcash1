import { useState, useRef, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Layout from '@/components/Layout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useRouletteData } from '@/hooks/useRouletteData';
import useRouletteTrends from '@/hooks/useRouletteTrends';
import EventService from '@/services/EventService';
import GlowingCubeLoader from '@/components/GlowingCubeLoader';

// Interface para as mensagens do chat
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// Interface para os dados de números da roleta
interface RouletteNumbers {
  redCount?: number;
  blackCount?: number;
  greenCount?: number;
  redPercentage?: number;
  blackPercentage?: number;
  greenPercentage?: number;
  evenCount?: number;
  oddCount?: number;
  evenPercentage?: number;
  oddPercentage?: number;
  dozenCounts?: number[];
  dozenPercentages?: number[];
  columnCounts?: number[];
  columnPercentages?: number[];
  highCount?: number;
  lowCount?: number;
  highPercentage?: number;
  lowPercentage?: number;
  hotNumbers?: any[];
  coldNumbers?: any[];
  [key: string]: any; // Para qualquer outra propriedade que possa existir
}

// Interface para os dados de trends da roleta
interface RouletteTrendsData {
  trends: any;
  isLoading?: boolean;
}

// Lista de exemplos de perguntas que podem ser feitas à IA
const EXAMPLE_QUESTIONS = [
  "Qual é a tendência atual para a roleta Crazy Time?",
  "Quais números têm aparecido com mais frequência na roleta Lightning?",
  "Me mostre os padrões que ocorreram nas últimas 20 jogadas",
  "Qual seria a melhor estratégia de aposta com base nos últimos resultados?",
  "Identifique sequências repetidas nas últimas 50 rodadas",
  "Qual é a probabilidade de sair um número vermelho nas próximas 3 jogadas?",
];

// Renomeado para evitar conflito com o import
const StatsTabContent = ({value, stats, isLoadingData, hasError, useExampleQuestion}) => {
  if (value === 'suggestions') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perguntas sugeridas</CardTitle>
          <CardDescription>Clique para usar uma pergunta pré-definida</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {EXAMPLE_QUESTIONS.map((question, index) => (
              <Button 
                key={index} 
                variant="outline" 
                className="w-full justify-start text-left h-auto py-2 px-3"
                onClick={() => useExampleQuestion(question)}
              >
                {question}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  } 
  
  if (value === 'stats') {
    if (hasError) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estatísticas Indisponíveis</CardTitle>
            <CardDescription>Não foi possível carregar os dados</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              O serviço de estatísticas está temporariamente indisponível. 
              Tente novamente mais tarde ou contate o suporte se o problema persistir.
            </div>
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      );
    }
    
    if (isLoadingData) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estatísticas Rápidas</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center items-center py-8">
            <GlowingCubeLoader size="medium" showLabels={true} />
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Estatísticas Rápidas</CardTitle>
          <CardDescription>Dados das últimas 100 rodadas</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Proporção de Cores</div>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-red-500/20">
                Vermelho: {stats.redCount} ({stats.redPercentage}%)
              </Badge>
              <Badge variant="outline" className="bg-black/20">
                Preto: {stats.blackCount} ({stats.blackPercentage}%)
              </Badge>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium mb-1">Paridade</div>
            <div className="flex gap-2">
              <Badge variant="outline">
                Pares: {stats.evenCount} ({stats.evenPercentage}%)
              </Badge>
              <Badge variant="outline">
                Ímpares: {stats.oddCount} ({stats.oddPercentage}%)
              </Badge>
            </div>
          </div>
          
          <div>
            <div className="text-sm font-medium mb-1">Dúzias</div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                1ª: {stats.dozenCounts[0] || 0} ({stats.dozenPercentages[0] || 0}%)
              </Badge>
              <Badge variant="outline">
                2ª: {stats.dozenCounts[1] || 0} ({stats.dozenPercentages[1] || 0}%)
              </Badge>
              <Badge variant="outline">
                3ª: {stats.dozenCounts[2] || 0} ({stats.dozenPercentages[2] || 0}%)
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return null;
};

// Componente principal da página
export default function AIAnalysisPage() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Olá! Sou a IA de análise de roletas RunCash. Como posso ajudar com suas análises hoje?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rouletteDataError, setRouletteDataError] = useState<string | null>(null);
  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // Hooks personalizados para obter dados da roleta - com fallback para evitar erros
  let rouletteData;
  try {
    rouletteData = useRouletteData('1', 'Premium European Roulette', 100);
  } catch (error) {
    console.error('Erro ao carregar dados da roleta:', error);
    setRouletteDataError('Falha ao carregar dados da roleta. Tente novamente mais tarde.');
    rouletteData = { numbers: {}, loading: false, error: true };
  }
  
  // Garantindo que numbers tenha valor padrão caso venha undefined
  const numbers = (rouletteData?.numbers || {}) as RouletteNumbers;
  const isLoadingRouletteData = rouletteData?.loading || false;
  
  // Adicionando tratamento de erro para o hook de tendências
  let trendData: RouletteTrendsData = { trends: [] };
  try {
    trendData = useRouletteTrends();
  } catch (error) {
    console.error('Erro ao carregar tendências:', error);
    setTrendsError('Falha ao carregar dados de tendências. Tente novamente mais tarde.');
  }
  const { trends = [] } = trendData;

  // Ouvir eventos de erro da API
  useEffect(() => {
    // Função para lidar com falhas na API
    const handleApiFailure = (event: any) => {
      console.error('Evento de falha na API recebido:', event);
      setApiError(`Falha na comunicação com o servidor: ${event.error || 'Erro desconhecido'}`);
    };

    // Função para lidar com erros de inicialização
    const handleInitError = (event: any) => {
      console.error('Erro na inicialização do sistema de roletas:', event);
      setRouletteDataError(`Erro de inicialização: ${event.message || 'Falha desconhecida'}`);
    };

    // Ouvir eventos de erro
    EventService.on('roulette:api-failure', handleApiFailure);
    EventService.on('roulette:initialization-error', handleInitError);
    EventService.on('roulette:critical-error', handleInitError); // Mesmo handler para erros críticos

    // Limpeza quando o componente for desmontado
    return () => {
      EventService.off('roulette:api-failure', handleApiFailure);
      EventService.off('roulette:initialization-error', handleInitError);
      EventService.off('roulette:critical-error', handleInitError);
    };
  }, []);

  // Notificar o usuário sobre erros na carga de dados
  useEffect(() => {
    if (rouletteDataError) {
      toast({
        title: "Erro de conexão",
        description: rouletteDataError,
        variant: "destructive",
      });
    }
    
    if (trendsError) {
      toast({
        title: "Erro de tendências",
        description: trendsError,
        variant: "destructive",
      });
    }

    if (apiError) {
      toast({
        title: "Problema na API",
        description: apiError,
        variant: "destructive",
      });
    }
  }, [rouletteDataError, trendsError, apiError, toast]);

  // Função para enviar mensagem para a IA
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Preparar os dados da roleta para enviar junto com a consulta
      const rouletteDataForAI = {
        numbers: {
          recent: Array.isArray(numbers.raw) ? numbers.raw.slice(0, 20) : [],
          redCount,
          blackCount,
          redPercentage,
          blackPercentage,
          evenCount,
          oddCount,
          evenPercentage,
          oddPercentage,
          dozenCounts,
          dozenPercentages,
          hotNumbers: numbers.hotNumbers || [],
          coldNumbers: numbers.coldNumbers || []
        },
        trends: trends || []
      };

      // Chamada real à API de IA com dados para análise
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: input,
          rouletteData: rouletteDataForAI
        }),
      });

      if (!response.ok) {
        throw new Error('Falha na comunicação com a API');
      }

      const data = await response.json();
      
      // Adicionar resposta da IA
      const aiMessage: Message = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Erro ao processar consulta de IA:', error);
      toast({
        variant: "destructive",
        title: "Erro na análise",
        description: "Não foi possível processar sua consulta. Tente novamente mais tarde.",
      });
      
      // Adicionar mensagem de erro para o usuário
      const errorMessage: Message = {
        role: 'assistant',
        content: "Desculpe, não consegui processar sua consulta no momento. Por favor, tente novamente mais tarde ou contate o suporte se o problema persistir.",
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Scrollar para a última mensagem sempre que uma nova mensagem é adicionada
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focar no input quando a página é carregada
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Lidar com a submissão do formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Usar uma sugestão de exemplo
  const useExampleQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  // Extração segura de valores para evitar erros de undefined
  const redCount = numbers.redCount || 0;
  const blackCount = numbers.blackCount || 0;
  const redPercentage = numbers.redPercentage || 0; 
  const blackPercentage = numbers.blackPercentage || 0;
  const evenCount = numbers.evenCount || 0;
  const oddCount = numbers.oddCount || 0;
  const evenPercentage = numbers.evenPercentage || 0;
  const oddPercentage = numbers.oddPercentage || 0;
  const dozenCounts = numbers.dozenCounts || [0, 0, 0];
  const dozenPercentages = numbers.dozenPercentages || [0, 0, 0];

  // Verificar se há algum erro nos dados
  const hasDataError = rouletteDataError !== null || trendsError !== null || apiError !== null || rouletteData?.error === true;

  return (
    <Layout>
      <Helmet>
        <title>Análise de IA | RunCash</title>
        <meta name="description" content="Utilize nossa IA para analisar padrões e tendências nas roletas" />
      </Helmet>

      <div className="container max-w-6xl mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Análise Inteligente de Roletas</h1>
        
        {hasDataError && (
          <div className="bg-destructive/10 text-destructive rounded-md p-3 mb-4">
            <p className="font-medium">Alerta: Serviço de Dados Indisponível</p>
            <p className="text-sm">Algumas funcionalidades de análise estatística podem não estar disponíveis.</p>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Painel principal de chat com a IA */}
          <div className="md:col-span-3">
            <Card className="h-[calc(100vh-220px)] flex flex-col">
              <CardHeader>
                <CardTitle>Assistente de Análise RunCash</CardTitle>
                <CardDescription>
                  Faça perguntas sobre padrões, tendências e estratégias baseadas nos dados das roletas
                </CardDescription>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-hidden">
                <ScrollArea className="h-[calc(100vh-370px)] pr-4">
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={cn(
                          "w-full flex",
                          message.role === 'user' ? "justify-end" : "justify-start"
                        )}
                      >
                        {message.role === 'assistant' && (
                          <Avatar className="h-8 w-8 mt-1 mr-3">
                            <AvatarImage src="/ai-assistant.png" alt="IA" />
                            <AvatarFallback>IA</AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={cn(
                          "rounded-lg px-4 py-2 text-sm max-w-[75%]",
                          message.role === 'assistant' 
                            ? "bg-primary/10 text-foreground" 
                            : "bg-primary text-primary-foreground"
                        )}>
                          {message.content}
                          <div className="text-xs opacity-50 mt-1 text-right">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                        
                        {message.role === 'user' && (
                          <Avatar className="h-8 w-8 mt-1 ml-3">
                            <AvatarFallback>EU</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex items-start">
                        <Avatar className="h-8 w-8 mr-3">
                          <AvatarImage src="/ai-assistant.png" alt="IA" />
                          <AvatarFallback>IA</AvatarFallback>
                        </Avatar>
                        <div className="scale-50 origin-left">
                          <GlowingCubeLoader size="small" showLabels={false} />
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
              
              <CardFooter>
                <form onSubmit={handleSubmit} className="w-full flex gap-2">
                  <Input
                    ref={inputRef}
                    placeholder="Pergunte sobre tendências, padrões ou estratégias..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading || !input.trim()}>
                    Enviar
                  </Button>
                </form>
              </CardFooter>
            </Card>
          </div>
          
          {/* Painel lateral com sugestões e estatísticas */}
          <div className="md:col-span-1">
            <Tabs defaultValue="suggestions">
              <TabsList className="w-full">
                <TabsTrigger value="suggestions" className="flex-1">Sugestões</TabsTrigger>
                <TabsTrigger value="stats" className="flex-1">Estatísticas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="suggestions">
                <StatsTabContent 
                  stats={{}} 
                  isLoadingData={false} 
                  hasError={false} 
                  value="suggestions"
                  useExampleQuestion={useExampleQuestion}
                />
              </TabsContent>
              
              <TabsContent value="stats">
                <StatsTabContent 
                  stats={{
                    redCount,
                    blackCount, 
                    redPercentage,
                    blackPercentage,
                    evenCount,
                    oddCount,
                    evenPercentage,
                    oddPercentage,
                    dozenCounts,
                    dozenPercentages
                  }} 
                  isLoadingData={isLoadingRouletteData}
                  hasError={hasDataError}
                  value="stats"
                  useExampleQuestion={useExampleQuestion}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
} 