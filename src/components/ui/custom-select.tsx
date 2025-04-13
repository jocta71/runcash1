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
  return <div className="relative" ref={selectRef}>
      <div className="relative cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        
        
      </div>

      {isOpen && <div className="absolute z-10 w-full mt-1 bg-white dark:bg-vegas-darkgray border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-60 overflow-auto">
          {options.map((option, index) => <div key={index} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer" onClick={() => handleSelect(option)}>
              {option}
            </div>)}
        </div>}
    </div>;
};
export { CustomSelect };