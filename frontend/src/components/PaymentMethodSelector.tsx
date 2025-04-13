import React, { useState } from 'react';

interface PaymentMethodSelectorProps {
  onSelect: (method: 'asaas' | 'hubla') => void;
  selectedMethod?: 'asaas' | 'hubla';
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  onSelect,
  selectedMethod
}) => {
  const [selected, setSelected] = useState<'asaas' | 'hubla' | undefined>(selectedMethod);

  const handleSelect = (method: 'asaas' | 'hubla') => {
    setSelected(method);
    onSelect(method);
  };

  return (
    <div className="w-full mb-6">
      <h3 className="text-lg font-medium mb-3">Selecione a forma de pagamento</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div 
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            selected === 'asaas' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => handleSelect('asaas')}
        >
          <div className="flex items-center">
            <div className="w-6 h-6 mr-3">
              <div className={`w-5 h-5 rounded-full border-2 ${
                selected === 'asaas' ? 'border-blue-500' : 'border-gray-300'
              } flex items-center justify-center`}>
                {selected === 'asaas' && (
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Asaas</h4>
              <p className="text-sm text-gray-600">Cartão de crédito, boleto e Pix</p>
            </div>
            <div className="ml-2">
              {/* Placeholder para logo do Asaas */}
              <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                Asaas
              </div>
            </div>
          </div>
        </div>

        <div 
          className={`border rounded-lg p-4 cursor-pointer transition-all ${
            selected === 'hubla' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => handleSelect('hubla')}
        >
          <div className="flex items-center">
            <div className="w-6 h-6 mr-3">
              <div className={`w-5 h-5 rounded-full border-2 ${
                selected === 'hubla' ? 'border-blue-500' : 'border-gray-300'
              } flex items-center justify-center`}>
                {selected === 'hubla' && (
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                )}
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Hubla</h4>
              <p className="text-sm text-gray-600">Cartão de crédito e outros métodos</p>
            </div>
            <div className="ml-2">
              {/* Placeholder para logo do Hubla */}
              <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                Hubla
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentMethodSelector; 