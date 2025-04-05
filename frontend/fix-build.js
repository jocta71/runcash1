// fix-build.js - Script to prevent "Cannot access before initialization" errors
const fs = require('fs');
const path = require('path');

console.log('Running build fix script to resolve initialization issues...');

// Configuration - Add variables that need initialization here
const GLOBAL_VARS = ['Yo'];
const FILES_TO_PATCH = [
  'src/main.tsx',
  'src/App.tsx',
  'src/components/RouletteCard.tsx'
];

/**
 * Creates a global initialization file
 */
function createGlobalInit() {
  console.log('Creating global initialization file...');
  
  // Generate the content with proper initialization for all variables
  let content = `// AUTO-GENERATED: Global initialization file
// This file ensures variables are initialized before they're accessed

// Global initialization IIFE to avoid polluting global scope
(function() {
  // Use var instead of let/const to avoid TDZ issues
  var initialized = {};
`;

  // Add each variable that needs initialization
  GLOBAL_VARS.forEach(varName => {
    content += `
  // Initialize ${varName} to prevent "Cannot access before initialization" errors
  var ${varName} = { initialized: true, timestamp: Date.now() };
  window.${varName} = ${varName};
  initialized['${varName}'] = true;
`;
  });

  content += `
  // Create a registry to track initialization
  window.__INIT_REGISTRY__ = initialized;
  
  // Log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[global-init] Variables initialized:', Object.keys(initialized));
  }
})();
`;

  // Write to global-init.js
  fs.writeFileSync(path.join(__dirname, 'src', 'global-init.js'), content);
  console.log('Global initialization file created successfully');
}

/**
 * Generates a TypeScript definition file for global variables
 */
function createTypeDefinitions() {
  console.log('Creating TypeScript definitions for global variables...');
  
  let content = `// AUTO-GENERATED: Global variable type definitions

// Declare global variables to make TypeScript happy
declare global {
  interface Window {
    __INIT_REGISTRY__: Record<string, boolean>;
`;

  // Add each variable to the global Window interface
  GLOBAL_VARS.forEach(varName => {
    content += `    ${varName}: { initialized: boolean, timestamp: number };
`;
  });

  content += `  }
}

// Export empty object to make this a module
export {};
`;

  // Write to globals.d.ts
  fs.writeFileSync(path.join(__dirname, 'src', 'globals.d.ts'), content);
  console.log('TypeScript definitions created successfully');
}

/**
 * Updates main.tsx to import the global-init.js file
 */
function updateMainEntry() {
  console.log('Updating main entry point...');
  
  const mainPath = path.join(__dirname, 'src', 'main.tsx');
  if (!fs.existsSync(mainPath)) {
    console.warn(`Warning: ${mainPath} not found, skipping update`);
    return;
  }
  
  let content = fs.readFileSync(mainPath, 'utf8');
  
  // Check if we already have the import
  if (!content.includes('global-init')) {
    content = `// Import initialization file first to prevent TDZ issues
import './global-init';

${content}`;
    
    fs.writeFileSync(mainPath, content);
    console.log('Updated main.tsx with global init import');
  } else {
    console.log('main.tsx already includes global-init import');
  }
}

/**
 * Patches files that might reference variables before initialization
 */
function patchFiles() {
  console.log('Patching files to add initialization imports...');
  
  FILES_TO_PATCH.forEach(filePath => {
    const fullPath = path.join(__dirname, filePath);
    if (!fs.existsSync(fullPath)) {
      console.warn(`Warning: ${fullPath} not found, skipping patch`);
      return;
    }
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Check if we already have a reference to global-init
    if (!content.includes('global-init') && !content.includes('// PATCHED-TDZ-FIX')) {
      // Add comment and import at the top of the file
      content = `// PATCHED-TDZ-FIX: Ensure global variables are initialized
// This import ensures that variables are initialized before they're accessed
import '../global-init';

${content}`;
      
      fs.writeFileSync(fullPath, content);
      console.log(`Patched ${filePath} with initialization import`);
    } else {
      console.log(`${filePath} already patched or doesn't need patching`);
    }
  });
}

// Execute the fixes
try {
  createGlobalInit();
  createTypeDefinitions();
  updateMainEntry();
  patchFiles();
  console.log('Build fix script completed successfully!');
} catch (error) {
  console.error('Error during build fix:', error);
  process.exit(1);
}
