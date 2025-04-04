// Este é o controller que busca todas as roletas
exports.getAllRoulettes = async (req, res) => {
  try {
    console.log('[Backend] Buscando todas as roletas');
    
    // Buscar no MongoDB - verificar qual campo está sendo usado
    const roulettes = await Roulette.find({}).sort({ nome: 1 });
    
    if (!roulettes || roulettes.length === 0) {
      console.log('[Backend] Nenhuma roleta encontrada, retornando roletas padrão');
      
      // Roletas padrão caso não encontre nenhuma no banco
      const defaultRoulettes = [
        { 
          id: "7d3c2c9f-2850-f642-861f-5bb4daf1806a", 
          nome: "Brazilian Mega Roulette", 
          numero: [], 
          estado_estrategia: "NEUTRAL",
          vitorias: 0,
          derrotas: 0
        },
        { 
          id: "18bdc4ea-d884-c47a-d33f-27a268a4eead", 
          nome: "Speed Auto Roulette", 
          numero: [], 
          estado_estrategia: "NEUTRAL",
          vitorias: 0,
          derrotas: 0
        },
        // ... outras roletas padrão
      ];
      
      // Incluir timestamp de atualização
      const responseWithTimestamp = defaultRoulettes.map(r => ({
        ...r,
        win_rate: (r.vitorias + r.derrotas > 0) ? ((r.vitorias / (r.vitorias + r.derrotas)) * 100).toFixed(1) + "%" : "N/A",
        updated_at: new Date().toISOString()
      }));
      
      return res.status(200).json(responseWithTimestamp);
    }
    
    console.log(`[Backend] Encontradas ${roulettes.length} roletas no banco de dados`);
    
    // Mapear os resultados para o formato esperado pela API
    const formattedRoulettes = roulettes.map(r => {
      const rouletteObj = r.toObject ? r.toObject() : r;
      
      // Verificar e converter dados antigos (se necessário)
      const numeroArray = Array.isArray(rouletteObj.numero) ? rouletteObj.numero : 
                        (Array.isArray(rouletteObj.numeros) ? rouletteObj.numeros : []);
      
      // Log para debug
      console.log(`[Backend] Roleta ${rouletteObj.nome || rouletteObj.id}: Encontrados ${numeroArray.length} números`);
      
      // Calcular win_rate
      const vitorias = rouletteObj.vitorias || 0;
      const derrotas = rouletteObj.derrotas || 0;
      const winRate = (vitorias + derrotas > 0) ? ((vitorias / (vitorias + derrotas)) * 100).toFixed(1) + "%" : "N/A";
      
      return {
        id: rouletteObj.id || rouletteObj._id,
        nome: rouletteObj.nome,
        // Usar somente "numero" (singular)
        numero: numeroArray,
        estado_estrategia: rouletteObj.estado_estrategia || "NEUTRAL",
        vitorias: vitorias,
        derrotas: derrotas,
        win_rate: winRate,
        updated_at: new Date().toISOString()
      };
    });
    
    return res.status(200).json(formattedRoulettes);
    
  } catch (error) {
    console.error('[Backend] Erro ao buscar roletas:', error);
    return res.status(500).json({ error: 'Erro ao buscar roletas', details: error.message });
  }
}; 