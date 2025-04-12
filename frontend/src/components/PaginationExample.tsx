import React, { useState } from 'react';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";

interface PaginationExampleProps {
  totalItems: number;
  itemsPerPage?: number;
  onPageChange?: (page: number) => void;
}

/**
 * Componente de exemplo para demonstrar paginação com o componente Pagination
 */
const PaginationExample: React.FC<PaginationExampleProps> = ({
  totalItems,
  itemsPerPage = 10,
  onPageChange
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  // Calcular índices dos itens na página atual
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  
  // Manipulador para mudança de página
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    if (onPageChange) {
      onPageChange(page);
    }
  };
  
  // Gerar um array de itens de demonstração para a página atual
  const generateDemoItems = () => {
    return Array.from(
      { length: Math.min(itemsPerPage, endIndex - startIndex) },
      (_, i) => startIndex + i + 1
    );
  };
  
  // Renderizar controle de paginação
  const renderPagination = () => {
    // Não mostrar paginação se houver apenas uma página
    if (totalPages <= 1) return null;
    
    // Calcular quais páginas mostrar
    let pagesToShow = [];
    const maxPageButtons = 5;
    
    if (totalPages <= maxPageButtons) {
      // Mostrar todas as páginas se for menor que o máximo
      pagesToShow = Array.from({ length: totalPages }, (_, i) => i + 1);
    } else {
      // Mostrar páginas ao redor da atual com elipses
      pagesToShow = [1]; // Sempre mostrar primeira página
      
      const middleStart = Math.max(2, currentPage - 1);
      const middleEnd = Math.min(totalPages - 1, currentPage + 1);
      
      // Adicionar elipse se necessário
      if (middleStart > 2) {
        pagesToShow.push(-1); // -1 representa elipse
      }
      
      // Adicionar páginas ao redor da atual
      for (let i = middleStart; i <= middleEnd; i++) {
        pagesToShow.push(i);
      }
      
      // Adicionar elipse se necessário
      if (middleEnd < totalPages - 1) {
        pagesToShow.push(-2); // -2 representa elipse no final
      }
      
      // Sempre mostrar última página
      pagesToShow.push(totalPages);
    }
    
    return (
      <Pagination className="my-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          
          {pagesToShow.map((page, index) => {
            // Renderizar elipses
            if (page < 0) {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <span className="mx-1">...</span>
                </PaginationItem>
              );
            }
            
            // Renderizar links para páginas
            return (
              <PaginationItem key={page}>
                <PaginationLink
                  isActive={currentPage === page}
                  onClick={() => handlePageChange(page)}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          
          <PaginationItem>
            <PaginationNext 
              onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
              className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    );
  };
  
  return (
    <div className="w-full p-4 border rounded-lg bg-white">
      <h2 className="text-lg font-semibold mb-4">Exemplo de Paginação</h2>
      
      {/* Informações sobre a página atual */}
      <div className="text-sm text-gray-500 mb-4">
        Mostrando itens {startIndex + 1}-{endIndex} de {totalItems} (Página {currentPage} de {totalPages})
      </div>
      
      {/* Lista de itens da página atual */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {generateDemoItems().map(item => (
          <div 
            key={item} 
            className="p-3 bg-gray-100 rounded-md text-center"
          >
            Item {item}
          </div>
        ))}
      </div>
      
      {/* Controle de paginação */}
      {renderPagination()}
    </div>
  );
};

export default PaginationExample; 