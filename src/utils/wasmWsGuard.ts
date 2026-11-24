/**
 * Guards WebSocket event handlers assigned by wasm-bindgen (e.g. @mercuryworkshop/epoxy-tls).
 *
 * In @mercuryworkshop/epoxy-tls 2.x, when a Wisp WebSocket fails, closes, or its
 * EpoxyClient is garbage-collected, Rust drops its wasm-bindgen Closure objects
 * (setting `fn.original.a = 0`) without always clearing `ws.onopen`/`onclose`/`onerror`/`onmessage`.
 * When the browser subsequently dispatches a WebSocket event, `WebSocket.real` invokes
 * the dropped Rust closure and throws `Error: closure invoked after being dropped`.
 *
 * Wrapping only wasm-bindgen closures assigned to `WebSocket.prototype` handlers (and
 * `addEventListener`) prevents invoking any dropped closure (`state.a === 0`) and detaches
 * the dead handler cleanly.
 */

const GUARDED_PROPS = ['onopen', 'onclose', 'onerror', 'onmessage'] as const;
type WsHandlerProp = (typeof GUARDED_PROPS)[number];

interface WasmClosureState {
  a: number;
  b: number;
  cnt: number;
  dtor: number;
}

function isWasmBindgenClosure(val: unknown): val is ((...args: any[]) => any) & { original: WasmClosureState } {
  if (typeof val !== 'function') return false;
  const orig = (val as any).original;
  return (
    !!orig &&
    typeof orig === 'object' &&
    'a' in orig &&
    'cnt' in orig &&
    'dtor' in orig
  );
}

function wrapWasmListener(
  fn: ((...args: any[]) => any) & { original: WasmClosureState },
  onDrop: (self: WebSocket) => void
): (...args: any[]) => any {
  const state = fn.original;
  return function (this: WebSocket, ...args: any[]) {
    if (!state || state.a === 0) {
      onDrop(this);
      return;
    }
    try {
      return fn.apply(this, args);
    } catch (err: any) {
      const msg = String(err?.message || err || '');
      if (msg.includes('closure invoked after being dropped')) {
        onDrop(this);
        return;
      }
      throw err;
    }
  };
}

export function installWasmWebSocketGuard(): void {
  if (typeof globalThis === 'undefined' || typeof WebSocket === 'undefined') return;
  const g = globalThis as any;
  const proto = WebSocket.prototype;

  if (!g.__frostWasmWsGuardInstalled) {
    g.__frostWasmWsGuardInstalled = true;
    const assignedHandlers = new WeakMap<WebSocket, Partial<Record<WsHandlerProp, any>>>();

    for (const prop of GUARDED_PROPS) {
      try {
        const origDesc = Object.getOwnPropertyDescriptor(proto, prop);
        if (!origDesc || !origDesc.configurable || typeof origDesc.set !== 'function') {
          continue;
        }

        const origGet = origDesc.get;
        const origSet = origDesc.set;

        Object.defineProperty(proto, prop, {
          configurable: true,
          enumerable: origDesc.enumerable ?? true,
          get(this: WebSocket) {
            const map = assignedHandlers.get(this);
            if (map && prop in map) {
              return map[prop];
            }
            return origGet ? origGet.call(this) : null;
          },
          set(this: WebSocket, val: any) {
            let map = assignedHandlers.get(this);
            if (!map) {
              map = {};
              assignedHandlers.set(this, map);
            }

            if (val == null) {
              delete map[prop];
              origSet.call(this, null);
              return;
            }

            if (!isWasmBindgenClosure(val)) {
              delete map[prop];
              origSet.call(this, val);
              return;
            }

            const state = val.original;
            if (!state || state.a === 0) {
              delete map[prop];
              origSet.call(this, null);
              return;
            }

            map[prop] = val;

            const guarded = wrapWasmListener(val, (self) => {
              const currentMap = assignedHandlers.get(self);
              if (currentMap) delete currentMap[prop];
              try {
                origSet.call(self, null);
              } catch {}
            });

            origSet.call(this, guarded);
          },
        });
      } catch {
        // Ignore if environment locks WebSocket.prototype descriptors
      }
    }
  }

  if (!g.__frostWasmWsAddListenerGuardInstalled) {
    g.__frostWasmWsAddListenerGuardInstalled = true;
    try {
    const origAdd = proto.addEventListener;
    const origRemove = proto.removeEventListener;
    if (typeof origAdd === 'function') {
      const listenerWrappers = new WeakMap<Function, EventListener>();
      proto.addEventListener = function (
        this: WebSocket,
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) {
        if (listener && isWasmBindgenClosure(listener)) {
          if (listener.original.a === 0) return;
          let wrapped = listenerWrappers.get(listener);
          if (!wrapped) {
            wrapped = wrapWasmListener(listener, (self) => {
              try {
                origRemove.call(self, type, wrapped!, options);
              } catch {}
            }) as EventListener;
            listenerWrappers.set(listener, wrapped);
          }
          return origAdd.call(this, type, wrapped, options);
        }
        return origAdd.call(this, type, listener as EventListenerOrEventListenerObject, options);
      };

      if (typeof origRemove === 'function') {
        proto.removeEventListener = function (
          this: WebSocket,
          type: string,
          listener: EventListenerOrEventListenerObject | null,
          options?: boolean | EventListenerOptions
        ) {
          if (typeof listener === 'function') {
            const wrapped = listenerWrappers.get(listener);
            if (wrapped) {
              return origRemove.call(this, type, wrapped, options);
            }
          }
          return origRemove.call(this, type, listener as EventListenerOrEventListenerObject, options);
        };
      }
    }
    } catch {}
  }
}
