import React, { useState, useRef, useEffect } from 'react';
import { Input } from './input';
import { ChevronsUpDown } from 'lucide-react';

interface CustomSelectProps {
  id: string;
  options: string[];
  defaultValue?: string;
  className?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
}

const CustomSelect = ({
  id,
  options,
  defaultValue = '',
  className = '',
  placeholder = 'Select an option',
  onChange
}: CustomSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (value: string) => {
    setSelectedValue(value);
    setIsOpen(false);
    onChange && onChange(value);
  };

  return (
    <div className={`relative ${className}`} ref={selectRef}>
      <div 
        className="flex items-center justify-between px-3 py-2 border rounded-md cursor-pointer bg-[#111118] border-[#33333359] text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedValue || placeholder}</span>
        <ChevronsUpDown size={16} className="text-gray-400" />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-[#111118] border border-[#33333359] rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map((option, index) => (
            <div 
              key={index} 
              className="px-4 py-2 text-sm text-white hover:bg-[#33333380] cursor-pointer"
              onClick={() => handleSelect(option)}
            >
              {option}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export { CustomSelect }; 