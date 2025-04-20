// Este é um exemplo de como implementar a funcionalidade de destacar números iguais
// na componente RouletteSidePanelStats

// 1. Adicionar o estado para armazenar o número selecionado
const [clickedNumber, setClickedNumber] = useState<number | null>(null);

// 2. Adicionar a função para lidar com o clique em um número
const handleNumberClick = (number: number) => {
  setClickedNumber(prevNumber => prevNumber === number ? null : number);
};

// 3. Modificar o trecho de JSX que exibe os números no histórico
// Na parte onde está o componente NumberDisplay, adicionar:

<NumberDisplay
  number={n.numero}
  size="small"
  highlight={idx === 0} // Destacar o número mais recente
  selected={clickedNumber !== null && n.numero === clickedNumber}
  onClick={handleNumberClick}
/>

// 4. Adicionar informação de destaque na descrição (opcional)
<CardDescription className="text-[10px] text-muted-foreground">
  {visibleNumbers.length} de {filteredNumbers.length} números
  {clickedNumber !== null && (
    <span className="ml-2">• Destacando: {clickedNumber}</span>
  )}
</CardDescription>

// 5. Adicionar botão para limpar a seleção (opcional)
{clickedNumber !== null && (
  <Button 
    onClick={() => setClickedNumber(null)} 
    variant="outline" 
    size="sm"
    className="h-6 flex items-center gap-1 text-xs border border-border"
  >
    <X className="h-3 w-3" /> Limpar
  </Button>
)} 