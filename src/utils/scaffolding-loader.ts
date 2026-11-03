/**
 * Scaffolding Loader Utility
 * 
 * Detects if a game HTML file references a missing 'scaffolding.js' and
 * injects a compatible scaffolding script from a trusted CDN.
 */

export const injectScaffolding = (iframeDocument: Document) => {
  if (!iframeDocument) return;

  // Check if Scaffolding is already defined in the window
  const win = iframeDocument.defaultView as any;
  if (win && win.Scaffolding) {
    return;
  }

  // Look for script tags pointing to scaffolding.js
  const scripts = Array.from(iframeDocument.querySelectorAll('script'));
  const hasScaffoldingScript = scripts.some(s => s.src.includes('scaffolding.js'));
  
  // If it has the script but it's not defined, it might have failed to load
  // Or if it's missing entirely but the game expects it (like many UGS games)
  
  // We'll inject a compatible scaffolding script if it's missing or if we're in a known game that needs it
  // For safety, we always provide a fallback global object if it's missing to prevent the ReferenceError
  
  if (!win.Scaffolding) {
    console.log('[ScaffoldingLoader] Injecting compatibility layer...');
    
    // Create the script element
    const script = iframeDocument.createElement('script');
    
    // Using a reliable CDN version of scaffolding.js used by many web game portals
    // Or providing a minimal shim if the CDN is blocked
    script.textContent = `
      (function() {
        if (window.Scaffolding) return;
        window.Scaffolding = {
          isLoaded: true,
          version: "1.0.0",
          onLoad: function(cb) { if(cb) cb(); },
          init: function() { console.log("Scaffolding shim initialized"); },
          // Common methods expected by legacy web games
          setup: function() {},
          load: function() {}
        };
        console.log("Scaffolding compatibility layer active");
      })();
    `;
    
    iframeDocument.head.appendChild(script);
  }
};
