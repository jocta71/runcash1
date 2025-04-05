// global-init.js
// This file initializes global variables before any other JavaScript is executed
// to prevent "Cannot access variable before initialization" errors

// --------------------------------------------------------------
// IMPORTANT: This file should be loaded and executed first during build
// --------------------------------------------------------------

// Initialize Yo and any other variables that might be accessed before initialization
(function() {
  // Use var instead of let/const to avoid temporal dead zone issues
  // Define globally accessible variables
  var Yo = {
    initialized: true, 
    timestamp: Date.now()
  };
  
  // Assign to window to make globally available
  window.Yo = Yo;
  
  // Create a global registry to track initialization order
  window.__GLOBAL_INIT__ = window.__GLOBAL_INIT__ || {
    initialized: {},
    registerModule: function(name) {
      this.initialized[name] = {
        timestamp: Date.now(),
        order: Object.keys(this.initialized).length
      };
      return true;
    }
  };
  
  // Register this module as initialized
  window.__GLOBAL_INIT__.registerModule('global-init');
  
  // Log initialization in development
  if (process.env.NODE_ENV !== 'production') {
    console.log('[global-init] Global variables initialized:', Yo);
  }
})();
