# Configuração de Variáveis de Ambiente no Railway

Este documento descreve como configurar as variáveis de ambiente no Railway para o projeto RunCash.

## Configuração da Lista de Roletas Permitidas

A variável de ambiente `VITE_ALLOWED_ROULETTES` controla quais roletas são exibidas no frontend. O valor deve ser uma lista de IDs de roletas separados por vírgula.

### Como configurar no Railway

1. Acesse o dashboard do Railway e selecione o serviço do frontend
2. Vá para a aba "Variables"
3. Adicione ou edite a variável `VITE_ALLOWED_ROULETTES` com o seguinte valor:
   ```
   VITE_ALLOWED_ROULETTES=2010011,2010012,2010013,2010014,2010016,2010017,2010018,2010031,2010033,2010045,2010047,2010048,2010049,2010050,2010051,2010059,2010065,2010071,2010072,2010075,2010096,2010097,2010098,2010099,2010100,2010103,2010108,2010110,2010143,2010154,2010161,2010163,2010165,2010166,2010168,2010170,2010172,2010176,2010177,2010181,2010336,2010337,2010339,2010340,2010341,2010439,2010440,2010478,2010512,2010527,2010548,2010565,2010582,2010680,2010685,2010708,2010714,2010727,2010734,2330817,2330846,2330131,2330134,2330145,2330266,2330173,2330448,2330489,2380010,2380013,2380032,2380033,2380034,2380038,2380039,2380049,2380064,2380117,2380125
   ```
4. Clique em "Deploy" para aplicar as alterações

### Verificação

Para verificar se a configuração está funcionando corretamente:

1. Abra o console de desenvolvimento do navegador (F12)
2. Verifique as mensagens de log que começam com `[CONFIG]`
3. Você deve ver uma mensagem como: `[CONFIG] Roletas permitidas: [lista dos IDs]`

Se você não vir essa mensagem ou se a lista estiver vazia, verifique se a variável foi configurada corretamente no Railway.

## Problemas Comuns

### A variável não está sendo reconhecida

Se a variável de ambiente parece estar configurada, mas não está funcionando:

1. Verifique se o nome está exatamente `VITE_ALLOWED_ROULETTES` (sem espaços ou caracteres extras)
2. Certifique-se de que o serviço foi reiniciado após a alteração
3. Limpe o cache do navegador ou use o modo anônimo para testar

### O filtro não está funcionando

Se as roletas continuam aparecendo mesmo após configurar a variável:

1. Verifique se o código foi atualizado para usar a lista definida pela variável
2. Certifique-se de que a lista contém os IDs corretos das roletas
3. Verifique se há conflitos com outras partes do código que possam estar ignorando o filtro 