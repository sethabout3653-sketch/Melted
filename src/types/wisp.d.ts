declare module '@mercuryworkshop/wisp-js/server' {
  export const server: {
    routeRequest: (req: any, socket: any, head: any, options?: any) => void;
    options?: Record<string, any>;
  };
}
