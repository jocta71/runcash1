import React, { createContext, useContext, useState } from 'react';

/**
 * Contexto para gerenciar a localização atual da navegação
 */
type LocationContextType = {
  currentLocation: string;
  setCurrentLocation: (location: string) => void;
  breadcrumbs: string[];
  setBreadcrumbs: (breadcrumbs: string[]) => void;
};

const defaultValue: LocationContextType = {
  currentLocation: '/',
  setCurrentLocation: () => {},
  breadcrumbs: [],
  setBreadcrumbs: () => {}
};

const LocationContext = createContext<LocationContextType>(defaultValue);

export const useLocationContext = () => useContext(LocationContext);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const [currentLocation, setCurrentLocation] = useState<string>('/');
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        setCurrentLocation,
        breadcrumbs,
        setBreadcrumbs
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}; 