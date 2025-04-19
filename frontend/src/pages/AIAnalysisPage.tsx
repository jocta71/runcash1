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
import useRouletteData from '@/hooks/useRouletteData';
import useRouletteTrends from '@/hooks/useRouletteTrends';

// Interface para as mensagens do chat
interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

  // Hooks personalizados para obter dados da roleta
  const { rouletteData, isLoading: isLoadingRouletteData } = useRouletteData();
  const { trends } = useRouletteTrends();

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
      // Chamada real à API de IA
      const response = await fetch('/api/ai/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: input }),
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

  return (
    <Layout>
      <Helmet>
        <title>Análise de IA | RunCash</title>
        <meta name="description" content="Utilize nossa IA para analisar padrões e tendências nas roletas" />
      </Helmet>

      <div className="container max-w-6xl mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Análise Inteligente de Roletas</h1>
        
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
                          "flex gap-3 w-max max-w-[80%]",
                          message.role === 'user' ? "ml-auto" : ""
                        )}
                      >
                        {message.role === 'assistant' && (
                          <Avatar className="h-8 w-8">
                            <AvatarImage src="/ai-assistant.png" alt="IA" />
                            <AvatarFallback>IA</AvatarFallback>
                          </Avatar>
                        )}
                        
                        <div className={cn(
                          "rounded-lg px-4 py-2 text-sm",
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
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>EU</AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))}
                    
                    {isLoading && (
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src="/ai-assistant.png" alt="IA" />
                          <AvatarFallback>IA</AvatarFallback>
                        </Avatar>
                        <div className="rounded-lg bg-primary/10 px-4 py-2 text-sm flex items-center space-x-2">
                          <Skeleton className="h-4 w-4 rounded-full bg-primary/20" />
                          <Skeleton className="h-4 w-4 rounded-full bg-primary/30" />
                          <Skeleton className="h-4 w-4 rounded-full bg-primary/40" />
                          <span className="ml-2 text-xs text-muted-foreground">Analisando dados...</span>
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
              </TabsContent>
              
              <TabsContent value="stats">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Estatísticas Rápidas</CardTitle>
                    <CardDescription>Dados das últimas 100 rodadas</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {isLoadingRouletteData ? (
                      <>
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-sm font-medium mb-1">Proporção de Cores</div>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="bg-red-500/20">
                              Vermelho: {rouletteData?.redCount || "..."} ({rouletteData?.redPercentage || "..."}%)
                            </Badge>
                            <Badge variant="outline" className="bg-black/20">
                              Preto: {rouletteData?.blackCount || "..."} ({rouletteData?.blackPercentage || "..."}%)
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium mb-1">Paridade</div>
                          <div className="flex gap-2">
                            <Badge variant="outline">
                              Pares: {rouletteData?.evenCount || "..."} ({rouletteData?.evenPercentage || "..."}%)
                            </Badge>
                            <Badge variant="outline">
                              Ímpares: {rouletteData?.oddCount || "..."} ({rouletteData?.oddPercentage || "..."}%)
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <div className="text-sm font-medium mb-1">Dúzias</div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              1ª: {rouletteData?.dozenCounts?.[0] || "..."} ({rouletteData?.dozenPercentages?.[0] || "..."}%)
                            </Badge>
                            <Badge variant="outline">
                              2ª: {rouletteData?.dozenCounts?.[1] || "..."} ({rouletteData?.dozenPercentages?.[1] || "..."}%)
                            </Badge>
                            <Badge variant="outline">
                              3ª: {rouletteData?.dozenCounts?.[2] || "..."} ({rouletteData?.dozenPercentages?.[2] || "..."}%)
                            </Badge>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
} 