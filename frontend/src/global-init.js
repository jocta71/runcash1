// AUTO-GENERATED: Global initialization file
// This file ensures variables are initialized before they're accessed

// Global initialization IIFE to avoid polluting global scope
(function() {
  // Use var instead of let/const to avoid TDZ issues
  var initialized = {};

  // Initialize Yo to prevent "Cannot access before initialization" errors
  var Yo = { initialized: true, timestamp: Date.now() };
  window.Yo = Yo;
  initialized['Yo'] = true;

  // Create a registry to track initialization
  window.__INIT_REGISTRY__ = initialized;
  
  // Log in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[global-init] Variables initialized:', Object.keys(initialized));
  }
})();
