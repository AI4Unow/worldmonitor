declare module 'virtual:pwa-register' {
  export function registerSW(options?: {
    onRegisteredSW?: (swUrl: string, registration: ServiceWorkerRegistration | undefined) => void;
    onOfflineReady?: () => void;
  }): void;
}
