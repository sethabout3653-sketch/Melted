/**
 * Game Input Bridge Utility
 * Injected into game iframes to ensure virtual touch buttons reliably trigger
 * keydown/keyup events inside the game runtime.
 */
export const injectGameInputBridge = (iframeDocument: Document, iframeWindow: Window) => {
  if (!iframeDocument || !iframeWindow) return;
  try {
    const win = iframeWindow as any;
    if (win.__frostInputBridgeInstalled) return;
    win.__frostInputBridgeInstalled = true;

    iframeWindow.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || (data.type !== 'FROST_SIMULATE_KEY' && data.type !== 'SIMULATE_KEY_DOWN' && data.type !== 'SIMULATE_KEY_UP')) {
        return;
      }

      const isDown = data.type === 'FROST_SIMULATE_KEY' ? data.typeEvent === 'keydown' : data.type === 'SIMULATE_KEY_DOWN';
      const eventType = isDown ? 'keydown' : 'keyup';
      const key = data.key || '';
      const code = data.code || '';
      const keyCode = data.keyCode || 0;
      const which = data.which || 0;

      try {
        const target = iframeDocument.activeElement || iframeDocument.body || iframeDocument;
        
        // Dispatch KeyboardEvent
        const kbEvent = new KeyboardEvent(eventType, {
          key,
          code,
          bubbles: true,
          cancelable: true,
          composed: true,
        });

        Object.defineProperties(kbEvent, {
          keyCode: { get: () => keyCode },
          which: { get: () => which },
          charCode: { get: () => keyCode },
        });

        target.dispatchEvent(kbEvent);
        iframeDocument.dispatchEvent(kbEvent);
        iframeWindow.dispatchEvent(kbEvent);

        // Also trigger keypress for down events
        if (isDown) {
          const kpEvent = new KeyboardEvent('keypress', {
            key,
            code,
            bubbles: true,
            cancelable: true,
            composed: true,
          });
          Object.defineProperties(kpEvent, {
            keyCode: { get: () => keyCode },
            which: { get: () => which },
            charCode: { get: () => keyCode },
          });
          target.dispatchEvent(kpEvent);
        }
      } catch (err) {
        console.warn('[GameInputBridge] Error dispatching simulated key:', err);
      }
    });

    console.log('[GameInputBridge] Installed successfully in game frame.');
  } catch (err) {
    console.warn('[GameInputBridge] Failed to install bridge:', err);
  }
};
