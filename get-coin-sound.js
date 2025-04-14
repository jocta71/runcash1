import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual no contexto de módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// URL de um som de moeda gratuito da freesound.org (licença CC0)
const soundUrl = 'https://cdn.freesound.org/sounds/388/388046-8b3ef57e-08ad-4d5f-aded-44d9d29b921a?filename=388046-08ad-4d5f-aded-44d9d29b921a.mp3';

// Caminho onde o som será salvo
const outputPath = path.join(__dirname, 'public', 'sounds', 'coin.mp3');

console.log(`Baixando som de moeda para ${outputPath}...`);

// Garantir que o diretório existe
const dir = path.dirname(outputPath);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
  console.log(`Diretório criado: ${dir}`);
}

// Baixar o arquivo
const file = fs.createWriteStream(outputPath);
https.get(soundUrl, (response) => {
  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    console.log('Download concluído!');
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {}); // Limpar arquivo parcial
  console.error(`Erro no download: ${err.message}`);
}); 