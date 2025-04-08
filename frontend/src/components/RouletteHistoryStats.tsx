import React, { useEffect, useState, useMemo } from 'react';
import { Box, Text, VStack, HStack, Spinner, Badge, SimpleGrid, Heading, Divider } from '@chakra-ui/react';
import { HistoryData } from '@/services/SocketService';
import RouletteFeedService from '@/services/RouletteFeedService';
import EventService from '@/services/EventService';

interface RouletteHistoryStatsProps {
  roletaId: string;
}

/**
 * Componente que exibe estatísticas baseadas no histórico completo de uma roleta
 */
const RouletteHistoryStats: React.FC<RouletteHistoryStatsProps> = ({ roletaId }) => {
  const [historyData, setHistoryData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Carregar o histórico ao montar o componente
  useEffect(() => {
    const loadHistory = async () => {
      if (!roletaId) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const feedService = RouletteFeedService.getInstance();
        const history = await feedService.getCompleteHistory(roletaId);
        setHistoryData(history);
      } catch (err) {
        console.error('Erro ao carregar histórico:', err);
        setError(`Falha ao carregar histórico: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };
    
    // Handlers para eventos
    const handleHistoryLoaded = (data: { roletaId: string, history: HistoryData }) => {
      if (data.roletaId === roletaId) {
        setHistoryData(data.history);
        setLoading(false);
      }
    };
    
    const handleHistoryError = (data: { roletaId: string, error: any }) => {
      if (data.roletaId === roletaId) {
        setError(`Erro: ${data.error?.message || 'Desconhecido'}`);
        setLoading(false);
      }
    };
    
    // Registrar listeners
    EventService.on('roulette:complete-history', handleHistoryLoaded);
    EventService.on('roulette:complete-history-error', handleHistoryError);
    
    // Carregar histórico
    loadHistory();
    
    // Cleanup listeners
    return () => {
      EventService.off('roulette:complete-history', handleHistoryLoaded);
      EventService.off('roulette:complete-history-error', handleHistoryError);
    };
  }, [roletaId]);
  
  // Computar estatísticas com useMemo para evitar recálculos desnecessários
  const stats = useMemo(() => {
    if (!historyData?.numeros?.length) return null;
    
    const numeros = historyData.numeros.map(item => item.numero);
    
    // Contagem de números
    const contagem: Record<number, number> = {};
    let numeroMaisFrequente = -1;
    let maiorFrequencia = 0;
    
    numeros.forEach(num => {
      contagem[num] = (contagem[num] || 0) + 1;
      if (contagem[num] > maiorFrequencia) {
        maiorFrequencia = contagem[num];
        numeroMaisFrequente = num;
      }
    });
    
    // Verificar pares, ímpares, vermelhos e pretos
    const vermelhos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    
    let countPares = 0;
    let countImpares = 0;
    let countVermelhos = 0;
    let countPretos = 0;
    let countZeros = 0;
    
    numeros.forEach(num => {
      if (num === 0) {
        countZeros++;
      } else {
        if (num % 2 === 0) countPares++;
        else countImpares++;
        
        if (vermelhos.includes(num)) countVermelhos++;
        else countPretos++;
      }
    });
    
    // Calcular porcentagens
    const total = numeros.length;
    
    return {
      total,
      numeroMaisFrequente,
      maiorFrequencia,
      frequenciaPorcentagem: ((maiorFrequencia / total) * 100).toFixed(1),
      pares: {
        count: countPares,
        porcentagem: ((countPares / total) * 100).toFixed(1)
      },
      impares: {
        count: countImpares,
        porcentagem: ((countImpares / total) * 100).toFixed(1)
      },
      vermelhos: {
        count: countVermelhos,
        porcentagem: ((countVermelhos / total) * 100).toFixed(1)
      },
      pretos: {
        count: countPretos,
        porcentagem: ((countPretos / total) * 100).toFixed(1)
      },
      zeros: {
        count: countZeros,
        porcentagem: ((countZeros / total) * 100).toFixed(1)
      },
      contagem
    };
  }, [historyData]);
  
  // Ordenar números por frequência (mais frequentes primeiro)
  const numerosPorFrequencia = useMemo(() => {
    if (!stats?.contagem) return [];
    
    return Object.entries(stats.contagem)
      .map(([numero, freq]) => ({ numero: parseInt(numero), frequencia: freq }))
      .sort((a, b) => b.frequencia - a.frequencia);
  }, [stats]);
  
  if (loading) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="lg" shadow="md">
        <VStack spacing={3} align="center">
          <Spinner size="lg" color="blue.500" />
          <Text>Carregando histórico completo...</Text>
        </VStack>
      </Box>
    );
  }
  
  if (error) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="lg" shadow="md" bg="red.50">
        <Text color="red.500" fontWeight="bold">{error}</Text>
      </Box>
    );
  }
  
  if (!historyData || !stats) {
    return (
      <Box p={4} borderWidth="1px" borderRadius="lg" shadow="md">
        <Text>Nenhum dado histórico disponível para esta roleta.</Text>
      </Box>
    );
  }
  
  return (
    <Box p={4} borderWidth="1px" borderRadius="lg" shadow="md">
      <VStack spacing={4} align="stretch">
        <Heading size="md">
          Estatísticas de Histórico - {historyData.roletaNome || `Roleta ${roletaId}`}
        </Heading>
        
        <Text fontSize="sm" color="gray.500">
          Baseado em {stats.total} registros históricos
        </Text>
        
        <Divider />
        
        <SimpleGrid columns={[2, 2, 3]} spacing={4}>
          <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
            <Text fontWeight="bold">Número mais frequente</Text>
            <Badge colorScheme="green" fontSize="xl" p={1}>
              {stats.numeroMaisFrequente} 
              <Text as="span" fontSize="sm" ml={1}>
                ({stats.maiorFrequencia}x - {stats.frequenciaPorcentagem}%)
              </Text>
            </Badge>
          </Box>
          
          <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
            <Text fontWeight="bold">Pares vs Ímpares</Text>
            <Text>
              Pares: {stats.pares.count} ({stats.pares.porcentagem}%)
            </Text>
            <Text>
              Ímpares: {stats.impares.count} ({stats.impares.porcentagem}%)
            </Text>
          </Box>
          
          <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
            <Text fontWeight="bold">Vermelhos vs Pretos</Text>
            <Text color="red.500">
              Vermelhos: {stats.vermelhos.count} ({stats.vermelhos.porcentagem}%)
            </Text>
            <Text>
              Pretos: {stats.pretos.count} ({stats.pretos.porcentagem}%)
            </Text>
          </Box>
          
          <Box p={3} borderWidth="1px" borderRadius="md" bg="gray.50">
            <Text fontWeight="bold">Zeros</Text>
            <Text color="green.500">
              Zero: {stats.zeros.count} ({stats.zeros.porcentagem}%)
            </Text>
          </Box>
        </SimpleGrid>
        
        <Divider />
        
        <Heading size="sm">Top 10 Números Mais Frequentes</Heading>
        
        <SimpleGrid columns={[2, 3, 5]} spacing={2}>
          {numerosPorFrequencia.slice(0, 10).map(({ numero, frequencia }) => (
            <HStack 
              key={numero} 
              p={2} 
              borderWidth="1px" 
              borderRadius="md" 
              justifyContent="space-between"
              bg={numero === 0 ? "green.50" : (numero % 2 === 0 ? "gray.50" : "red.50")}
            >
              <Badge 
                colorScheme={numero === 0 ? "green" : (numero % 2 === 0 ? "blackAlpha" : "red")}
                fontSize="md"
              >
                {numero}
              </Badge>
              <Text fontSize="sm" fontWeight="bold">{frequencia}x</Text>
            </HStack>
          ))}
        </SimpleGrid>
      </VStack>
    </Box>
  );
};

export default RouletteHistoryStats; 