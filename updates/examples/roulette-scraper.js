
// Este é um exemplo de script que poderia ser executado no Heroku
// Você precisará instalar: 
// npm install node-fetch puppeteer dotenv

require('dotenv').config();
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');

// URL do site que você deseja raspar
const TARGET_URL = 'https://exemplo-site-roleta.com';

// Configurações do Supabase
const SUPABASE_FUNCTION_URL = 'https://evzqzghxuttctbxgohpx.supabase.co/functions/v1/update-roulette-numbers';
const API_KEY = process.env.SCRAPER_API_KEY; // Defina esta variável no Heroku

async function scrapeRouletteNumbers() {
  console.log('Iniciando raspagem de números da roleta...');
  
  try {
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });
    
    const page = await browser.newPage();
    await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });
    
    // Exemplo: raspando números de diferentes roletas
    // (você precisará adaptar os seletores para seu site específico)
    const rouletteData = [
      {
        name: 'Roleta Brasileira',
        numbers: await extractNumbers(page, '#roleta-brasileira .numero')
      },
      {
        name: 'Roleta Europeia',
        numbers: await extractNumbers(page, '#roleta-europeia .numero')
      },
      // Adicione mais roletas conforme necessário
    ];
    
    await browser.close();
    
    // Enviar dados para o Supabase
    for (const roulette of rouletteData) {
      await sendToSupabase(roulette.name, roulette.numbers);
    }
    
    console.log('Processo de raspagem concluído com sucesso!');
  } catch (error) {
    console.error('Erro durante a raspagem:', error);
  }
}

async function extractNumbers(page, selector) {
  // Esta função extrai os números da página usando um seletor CSS
  // Você precisará adaptá-la ao site específico que está raspando
  
  return await page.evaluate((sel) => {
    const elements = Array.from(document.querySelectorAll(sel));
    return elements.slice(0, 10).map(el => parseInt(el.textContent.trim(), 10));
  }, selector);
}

async function sendToSupabase(rouletteName, numbers) {
  try {
    console.log(`Enviando ${numbers.length} números para ${rouletteName}...`);
    
    const response = await fetch(SUPABASE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        rouletteName,
        numbers
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log(`Sucesso! ${result.message}`);
    } else {
      console.error(`Erro ao enviar dados: ${result.error}`);
    }
  } catch (error) {
    console.error(`Erro ao enviar para o Supabase: ${error.message}`);
  }
}

// Executar a raspagem
scrapeRouletteNumbers();

// Para uso com um agendador como o node-cron, você poderia fazer:
// const cron = require('node-cron');
// cron.schedule('*/15 * * * *', scrapeRouletteNumbers); // A cada 15 minutos
