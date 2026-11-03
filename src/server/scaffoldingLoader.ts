/**
 * Scaffolding Loader Utility
 * 
 * Provides robust detection and injection of TurboWarp/Scratch scaffolding
 * into game HTML files to prevent "Scaffolding is not defined" errors.
 */

const TURBOWARP_SCAFFOLDING_URL = 'https://cdn.jsdelivr.net/npm/@turbowarp/packager@3.14.0/dist/scaffolding/scaffolding-min.js';

let cachedScaffoldingBuffer: Buffer | null = null;

/**
 * Fetches and caches the TurboWarp scaffolding runtime bundle.
 */
export async function getScaffoldingBuffer(): Promise<Buffer> {
  if (cachedScaffoldingBuffer) return cachedScaffoldingBuffer;
  try {
    const res = await fetch(TURBOWARP_SCAFFOLDING_URL);
    if (res.ok) {
      const arr = await res.arrayBuffer();
      cachedScaffoldingBuffer = Buffer.from(arr);
      return cachedScaffoldingBuffer;
    }
  } catch (err) {
    console.warn('[ScaffoldingLoader] Failed to pre-fetch bundle:', err);
  }
  return Buffer.from('/* TurboWarp Scaffolding Fallback */');
}

// Pre-fetch on load
getScaffoldingBuffer().catch(() => {});

/**
 * Generates a protection script that guards against ReferenceError
 * by providing a synchronous placeholder for the Scaffolding object
 * until the real library loads.
 */
export function getProtectionScript(): string {
  return `
    (function() {
      if (typeof window.Scaffolding !== 'undefined' && !window.Scaffolding._isPlaceholder) return;
      
      console.log('[ScaffoldingLoader] Injecting protective placeholder');
      
      function ScaffoldingPlaceholder() {
        console.warn('[ScaffoldingLoader] Scaffolding instantiated from placeholder. Waiting for runtime...');
        var self = this;
        this._isPlaceholder = true;
        this.width = 480;
        this.height = 360;
        this.setup = function() { return self; };
        this.appendTo = function() { return self; };
        this.vm = {
          setTurboMode: function() {},
          setInterpolation: function() {},
          setFramerate: function() {},
          setRuntimeOptions: function() {},
          setCompilerOptions: function() {},
          renderer: { setMaxTextureDimension: function() {}, setUseHighQualityRender: function() {} },
          runtime: { setEnforcePrivacy: function() {}, audioEngine: {}, v2BitmapAdapter: {}, ioDevices: { video: { provider: {} } } },
          extensionManager: { loadExtensionURL: function() {} }
        };
        this.addCloudProvider = function() {};
        this.setUsername = function() {};
        this.setAccentColor = function() {};
        this.setExtensionSecurityManager = function() {};
        this.start = function() {};
        this.loadProject = function() { return Promise.resolve(); };
        this.storage = { 
          onprogress: null, 
          addWebStore: function() {},
          AssetType: { ImageVector: 1, ImageBitmap: 2, Sound: 3, Font: 4 }
        };
        return this;
      }

      var proto = ScaffoldingPlaceholder.prototype;
      window.Scaffolding = {
        Scaffolding: ScaffoldingPlaceholder,
        Cloud: { WebSocketProvider: function() {} },
        _isPlaceholder: true
      };
      // Provide window.scaffolding as well
      if (!window.scaffolding) {
        window.scaffolding = new ScaffoldingPlaceholder();
      }
    })();
  `.replace(/\s+/g, ' ').trim();
}

/**
 * Processes game HTML content to inject protection and runtime scripts.
 */
export function processGameHtml(html: string, scriptProxyUrl: string): string {
  // Detection logic
  const hasScaffoldingRef = html.includes('scaffolding') || html.includes('Scaffolding') || html.includes('getProjectData');
  const hasTurboWarpRef = html.includes('TurboWarp') || html.includes('turbowarp');
  const hasScriptJsRef = html.includes('script.js');
  
  if (!hasScaffoldingRef && !hasTurboWarpRef && !hasScriptJsRef) {
    return html;
  }

  console.log('[ScaffoldingLoader] TurboWarp/Scaffolding detected in HTML, applying fix');

  const protectionScript = `<script>${getProtectionScript()}</script>`;
  const runtimeScript = `<script src="${scriptProxyUrl}"></script>`;

  // 1. Clean up existing broken relative script tags
  let updated = html.replace(
    /<script\s+src=["'](?:script|scaffolding|scaffolding-full|scaffolding-min)\.js["']\s*><\/script>/gi,
    runtimeScript
  );

  // 2. Inject protection and runtime at the very top of <head> or document
  const injection = `\n${protectionScript}\n${runtimeScript}\n`;
  
  // Try to inject before first script tag for earliest execution
  const firstScriptIdx = updated.indexOf('<script');
  if (firstScriptIdx >= 0 && firstScriptIdx < 500) { // Only if found reasonably early
    updated = updated.slice(0, firstScriptIdx) + injection + updated.slice(firstScriptIdx);
  } else if (updated.includes('<head>')) {
    updated = updated.replace('<head>', `<head>${injection}`);
  } else if (updated.includes('<HEAD>')) {
    updated = updated.replace('<HEAD>', `<HEAD>${injection}`);
  } else if (updated.includes('<html>')) {
    updated = updated.replace('<html>', `<html><head>${injection}</head>`);
  } else {
    updated = `${injection}\n` + updated;
  }

  return updated;
}
