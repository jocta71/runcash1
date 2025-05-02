// Função serverless para processamento de consultas de IA
// Utilizando o provedor de IA especificado nas variáveis de ambiente

const axios = require('axios');

async function processGeminiQuery(prompt) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        }
      }
    );
    
    // Extrair a resposta gerada
    if (response.data.candidates && response.data.candidates.length > 0) {
      const textParts = response.data.candidates[0].content.parts
        .filter(part => part.text)
        .map(part => part.text);
      return { success: true, response: textParts.join('\n') };
    }
    
    return { success: false, error: 'Nenhuma resposta gerada' };
  } catch (error) {
    console.error('Erro ao processar consulta Gemini:', error);
    return { 
      success: false, 
      error: 'Erro ao processar a consulta', 
      details: error.message
    };
  }
}

async function processOpenAIQuery(prompt) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2048
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        }
      }
    );
    
    return { 
      success: true, 
      response: response.data.choices[0].message.content 
    };
  } catch (error) {
    console.error('Erro ao processar consulta OpenAI:', error);
    return { 
      success: false, 
      error: 'Erro ao processar a consulta', 
      details: error.message
    };
  }
}

module.exports = async (req, res) => {
  // Configurar headers CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Responder às solicitações OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Parâmetro "prompt" é obrigatório' });
    }

    // Determinar qual provedor de IA usar com base na variável de ambiente
    const aiProvider = process.env.AI_PROVIDER || 'gemini';
    
    let result;
    if (aiProvider === 'openai') {
      result = await processOpenAIQuery(prompt);
    } else {
      // Padrão para Gemini
      result = await processGeminiQuery(prompt);
    }

    if (result.success) {
      return res.status(200).json({ response: result.response });
    } else {
      return res.status(500).json({ 
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Erro ao processar solicitação:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
}; 