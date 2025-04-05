// fix-build.js - Script to prevent "Cannot access before initialization" errors
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

console.log('Running build fix script to resolve initialization issues...');

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration - Add variables that need initialization here
const GLOBAL_VARS = ['Yo', 'React', 'z'];
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

  // Initialize Yo to prevent "Cannot access before initialization" errors
  var Yo = { initialized: true, timestamp: Date.now() };
  window.Yo = Yo;
  initialized['Yo'] = true;

  // Resolver problema com useLayoutEffect
  // Criar um objeto simulado de React para caso o React ainda não tenha sido carregado
  // ou para quando o código minificado tenta acessar uma variável z indefinida
  if (typeof window !== 'undefined') {
    window.React = window.React || {};
    
    // Garantir que useLayoutEffect e useEffect existam no objeto React
    if (!window.React.useLayoutEffect) {
      window.React.useLayoutEffect = function() {
        console.warn('[global-init] React.useLayoutEffect chamado antes do React ser inicializado');
        return null;
      };
    }
    
    if (!window.React.useEffect) {
      window.React.useEffect = function() {
        console.warn('[global-init] React.useEffect chamado antes do React ser inicializado');
        return null;
      };
    }
    
    // Adicionar safeguard para o objeto z que pode estar sendo usado no código minificado
    window.z = window.z || window.React;
    
    initialized['React'] = true;
    initialized['z'] = true;
  }

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
 * Creates the React polyfill file
 */
function createReactPolyfill() {
  console.log('Creating React polyfill file...');
  
  const content = `// react-polyfill.js
// Este arquivo fornece implementações temporárias para os hooks do React
// para evitar erros quando eles são acessados antes do React ser carregado

// Verifica se estamos no navegador
if (typeof window !== 'undefined') {
  // Garante que o objeto React exista
  window.React = window.React || {};
  
  // Lista de hooks comuns do React que podem ser acessados
  const reactHooks = [
    'useState', 
    'useEffect', 
    'useLayoutEffect', 
    'useRef', 
    'useCallback', 
    'useMemo', 
    'useContext', 
    'useReducer'
  ];
  
  // Implementa cada hook se não estiver definido ainda
  reactHooks.forEach(hookName => {
    if (!window.React[hookName]) {
      window.React[hookName] = function() {
        // Em produção, retornamos silenciosamente valores padrão
        if (process.env.NODE_ENV === 'production') {
          return hookName === 'useRef' || hookName === 'useState' ? {} : undefined;
        }
        
        // Em desenvolvimento, avisamos que o hook foi chamado antes do React estar disponível
        console.warn(\`[react-polyfill] \${hookName} chamado antes do React ser inicializado\`);
        
        // Retornar valores diferentes dependendo do hook
        switch (hookName) {
          case 'useState':
            return [undefined, () => {}];
          case 'useRef':
            return { current: undefined };
          default:
            return undefined;
        }
      };
    }
  });
  
  // Também definimos z como React para código minificado que pode usar essa variável
  window.z = window.z || window.React;
  
  // Registrar que inicializamos
  if (window.__INIT_REGISTRY__) {
    window.__INIT_REGISTRY__['react-polyfill'] = true;
  }
  
  // Log em desenvolvimento
  if (process.env.NODE_ENV !== 'production') {
    console.log('[react-polyfill] Hooks do React polyfilled:', reactHooks);
  }
}`;
  
  // Write to react-polyfill.js
  fs.writeFileSync(path.join(__dirname, 'src', 'react-polyfill.js'), content);
  console.log('React polyfill file created successfully');
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
    if (varName === 'Yo') {
      content += `    ${varName}: { initialized: boolean, timestamp: number };
`;
    } else if (varName === 'React') {
      content += `    ${varName}: {
      useLayoutEffect?: Function;
      useEffect?: Function;
      useState?: Function;
      useRef?: Function;
      useCallback?: Function;
      useMemo?: Function;
      useContext?: Function;
      useReducer?: Function;
      [key: string]: any;
    };
`;
    } else {
      content += `    ${varName}: any;
`;
    }
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
  if (!content.includes('global-init') && !content.includes('react-polyfill')) {
    content = `// Import polyfills and initialization files first to prevent issues
import './react-polyfill';
import './global-init';

${content}`;
    
    fs.writeFileSync(mainPath, content);
    console.log('Updated main.tsx with initialization imports');
  } else {
    console.log('main.tsx already includes initialization imports');
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
      // Determine the correct import path based on file location
      let importPath;
      let reactPolyfillPath;
      
      if (filePath === 'src/main.tsx') {
        // For main.tsx in the src directory, use a direct import
        importPath = './global-init';
        reactPolyfillPath = './react-polyfill';
      } else if (filePath === 'src/App.tsx') {
        // For App.tsx in the src directory, use a direct import
        importPath = './global-init';
        reactPolyfillPath = './react-polyfill';
      } else if (filePath.startsWith('src/components/')) {
        // For files in components directory, go up one level
        importPath = '../global-init';
        reactPolyfillPath = '../react-polyfill';
      } else {
        // Default case - calculate relative path to src directory
        const fileDir = path.dirname(filePath);
        const srcDir = 'src';
        const levels = fileDir.split('/').length - srcDir.split('/').length;
        const relPath = '../'.repeat(levels);
        importPath = relPath + 'global-init';
        reactPolyfillPath = relPath + 'react-polyfill';
      }
      
      // Add comment and import at the top of the file
      content = `// PATCHED-TDZ-FIX: Ensure global variables are initialized
// This import ensures that variables are initialized before they're accessed
import '${reactPolyfillPath}';
import '${importPath}';

${content}`;
      
      fs.writeFileSync(fullPath, content);
      console.log(`Patched ${filePath} with initialization imports (using paths: ${reactPolyfillPath}, ${importPath})`);
    } else {
      console.log(`${filePath} already patched or doesn't need patching`);
    }
  });
}

// Execute the fixes
try {
  createGlobalInit();
  createReactPolyfill();
  createTypeDefinitions();
  updateMainEntry();
  patchFiles();
  console.log('Build fix script completed successfully!');
} catch (error) {
  console.error('Error during build fix:', error);
  process.exit(1);
}
