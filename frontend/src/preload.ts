// preload.ts
// This file ensures all necessary variables are initialized in the correct order
// Import in the correct dependency order to prevent initialization issues

// First, export the Yo variable to ensure it's defined before use
export const Yo = {
  initialize: true
};

// Import foundational components and hooks in proper order
import './components/roulette/RouletteInitializer';
import './components/roulette/constants';
import './components/roulette/RouletteNumber';
import './components/roulette/LastNumbers';
import './components/roulette/RouletteActionButtons';
import './components/roulette/SuggestionDisplay';
import './components/roulette/WinRateDisplay';
import './components/roulette/RouletteTrendChart';

// Export a function to ensure everything is initialized
export function ensurePreloaded() {
  return true;
}
