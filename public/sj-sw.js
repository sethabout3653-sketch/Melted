// Prevent 'Failed to construct Response: Response with null body status cannot have body'
const _NativeResponse = self.Response;
self.Response = class ScramjetPatchedResponse extends _NativeResponse {
  constructor(body, init) {
    const status = init && typeof init === 'object' ? init.status : undefined;
    if (status === 204 || status === 205 || status === 304 || status === 101) {
      super(null, init);
      return;
    }
    super(body, init);
  }
};

importScripts('/controller/controller.sw.js');

self.addEventListener('fetch', (event) => {
  if (typeof $scramjetController !== 'undefined' && $scramjetController.shouldRoute(event)) {
    event.respondWith(
      $scramjetController.route(event).then((res) => {
        if (res && (res.status === 204 || res.status === 205 || res.status === 304 || res.status === 101)) {
          return new _NativeResponse(null, {
            status: res.status,
            statusText: res.statusText,
            headers: res.headers,
          });
        }
        return res;
      })
    );
  }
});

