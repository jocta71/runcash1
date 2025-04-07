/**
 * Rotas de API para gerenciamento de configurações
 * Permite atualizar configurações do sistema em tempo real
 */

const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Caminho para o arquivo JSON que armazenará as configurações
const configFilePath = path.join(__dirname, '../config/roletas_permitidas.json');
const CONFIG_DIR = path.join(__dirname, '../config');

// Garantir que o diretório de configuração exista
async function ensureConfigDir() {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  } catch (error) {
    console.error('Erro ao criar diretório de configuração:', error);
  }
}

// Endpoint para obter as roletas permitidas atuais
router.get('/allowed-roulettes', async (req, res) => {
  try {
    const config = await readConfig();
    res.json({ 
      allowedRoulettes: config.allowedRoulettes,
      totalCount: config.allowedRoulettes.length
    });
  } catch (error) {
    console.error('Erro ao ler configuração:', error);
    res.status(500).json({ error: 'Erro ao ler configuração', details: error.message });
  }
});

// Endpoint para atualizar as roletas permitidas
router.post('/allowed-roulettes', async (req, res) => {
  try {
    const { allowedRoulettes } = req.body;
    
    if (!Array.isArray(allowedRoulettes)) {
      return res.status(400).json({ 
        error: 'O formato esperado é um array de IDs de roletas' 
      });
    }
    
    // Remover duplicatas e valores vazios
    const sanitizedRoulettes = [...new Set(
      allowedRoulettes
        .map(id => String(id).trim())
        .filter(id => id !== '')
    )];
    
    const config = await readConfig();
    config.allowedRoulettes = sanitizedRoulettes;
    
    await writeConfig(config);
    
    // Criar/atualizar o arquivo Python com a nova lista
    await updatePythonConfig(sanitizedRoulettes);
    
    res.json({ 
      success: true, 
      message: 'Roletas permitidas atualizadas com sucesso',
      allowedRoulettes: sanitizedRoulettes,
      totalCount: sanitizedRoulettes.length
    });
  } catch (error) {
    console.error('Erro ao atualizar configuração:', error);
    res.status(500).json({ error: 'Erro ao atualizar configuração', details: error.message });
  }
});

// Função para atualizar o arquivo Python usado pelo scraper
async function updatePythonConfig(roulettes) {
  const pythonFilePath = path.join(__dirname, '../../scraper/roletas_permitidas_dinamicas.py');
  const content = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Roletas permitidas dinâmicas - GERADO AUTOMATICAMENTE PELO API SERVER
NÃO EDITE MANUALMENTE ESTE ARQUIVO!
"""

# Lista de roletas permitidas definida dinamicamente pela API
ALLOWED_ROULETTES = [
    ${roulettes.map(id => `"${id}"`).join(',\n    ')}
]

# Para usar em outros módulos
def get_allowed_roulettes():
    return ALLOWED_ROULETTES
`;

  try {
    await fs.writeFile(pythonFilePath, content, 'utf8');
    console.log(`Arquivo Python atualizado: ${pythonFilePath}`);
    return true;
  } catch (error) {
    console.error('Erro ao atualizar arquivo Python:', error);
    return false;
  }
}

// Função para ler o arquivo de configuração
async function readConfig() {
  try {
    await ensureConfigDir();
    const data = await fs.readFile(configFilePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Se o arquivo não existir, criar um padrão
    const defaultRoulettes = process.env.VITE_ALLOWED_ROULETTES 
      ? process.env.VITE_ALLOWED_ROULETTES.split(',').map(id => id.trim())
      : ["2010016","2380335","2010065","2010096","2010017","2010098"];
    
    const defaultConfig = {
      allowedRoulettes: defaultRoulettes,
      lastUpdated: new Date().toISOString()
    };
    
    await writeConfig(defaultConfig);
    return defaultConfig;
  }
}

// Função para escrever no arquivo de configuração
async function writeConfig(config) {
  await ensureConfigDir();
  config.lastUpdated = new Date().toISOString();
  await fs.writeFile(configFilePath, JSON.stringify(config, null, 2), 'utf8');
}

module.exports = router; 