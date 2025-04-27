// Proxy específico para endpoint de roletas
import https from 'https';
import http from 'http';

export default async function handler(req, res) {
  // Configurar CORS para permitir credenciais
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Responder imediatamente a solicitações preflight OPTIONS
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Defina o URL do backend (Railway)
    const backendUrl = process.env.BACKEND_URL || 'https://backend-production-2f96.up.railway.app';
    
    // Extrair parâmetros da consulta - ROULETTES é o padrão
    const query = new URLSearchParams(req.query);
    const endpoint = query.get('endpoint') || 'ROULETTES';
    // Remover o parâmetro endpoint para não duplicar na URL
    query.delete('endpoint');
    
    // Preservar outros parâmetros na consulta
    const queryString = query.toString();
    const path = `/api/${endpoint}${queryString ? `?${queryString}` : ''}`;
    
    console.log(`[Proxy Roleta] Redirecionando para: ${backendUrl}${path}`);

    // Preparar a solicitação para o backend
    const options = {
      method: req.method,
      headers: {
        ...req.headers,
        host: new URL(backendUrl).host,
        // Adicionar headers específicos para depuração
        'X-Forwarded-From': 'vercel-proxy-roulette',
        'X-Original-URL': req.url
      }
    };

    // Escolher http ou https com base na URL
    const protocolClient = backendUrl.startsWith('https') ? https : http;
    
    // Montar o corpo da solicitação para métodos POST
    let requestBody = '';
    if (req.method === 'POST') {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      requestBody = Buffer.concat(buffers).toString();
    }

    // Fazer a solicitação ao backend
    const backendReq = protocolClient.request(
      `${backendUrl}${path}`,
      options,
      (backendRes) => {
        // Responder com o código de status do backend
        res.statusCode = backendRes.statusCode;
        
        // Copiar headers da resposta, exceto CORS que serão definidos pelo Vercel
        Object.entries(backendRes.headers).forEach(([key, value]) => {
          if (!key.toLowerCase().startsWith('access-control-')) {
            res.setHeader(key, value);
          }
        });
        
        // Transmitir a resposta do backend para o cliente
        backendRes.pipe(res);
        
        // Registrar o resultado
        console.log(`[Proxy Roleta] Resposta: ${backendRes.statusCode}`);
      }
    );
    
    // Lidar com erros na solicitação
    backendReq.on('error', (error) => {
      console.error(`[Proxy Roleta] Erro: ${error.message}`);
      res.status(500).json({ 
        error: "Erro ao conectar ao backend", 
        message: error.message,
        origin: "proxy-roulette"
      });
    });
    
    // Enviar corpo para solicitações POST
    if (req.method === 'POST' && requestBody) {
      backendReq.write(requestBody);
    }
    
    // Finalizar a solicitação
    backendReq.end();
    
  } catch (error) {
    console.error(`[Proxy Roleta] Erro na execução: ${error.message}`);
    res.status(500).json({ 
      error: "Erro interno no proxy", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
} 