// web/src/types/service-worker.d.ts

interface BackgroundFetchManager {
  fetch(
    id: string,
    requests: RequestInfo | RequestInfo[],
    options?: BackgroundFetchOptions
  ): Promise<BackgroundFetchRegistration>;
  get(id: string): Promise<BackgroundFetchRegistration | undefined>;
  getIds(): Promise<string[]>;
}

interface BackgroundFetchOptions {
  title?: string;
  icons?: ImageResource[];
  downloadTotal?: number;
}

interface ImageResource {
  src: string;
  sizes?: string;
  type?: string;
}

interface BackgroundFetchRegistration extends EventTarget {
  id: string;
  uploadTotal: number;
  uploaded: number;
  downloadTotal: number;
  downloaded: number;
  result: 'success' | 'failure' | '';
  recordsAvailable: boolean;
  abort(): Promise<boolean>;
  match(
    request: RequestInfo,
    options?: CacheQueryOptions
  ): Promise<Response | undefined>;
  matchAll(
    request?: RequestInfo,
    options?: CacheQueryOptions
  ): Promise<readonly Response[]>;
}

declare global {
  interface ServiceWorkerRegistration {
    readonly backgroundFetch: BackgroundFetchManager;
  }

  interface Window {
    BackgroundFetchManager: new () => BackgroundFetchManager;
  }

  interface ServiceWorkerGlobalScope {
    addEventListener(type: 'backgroundfetchsuccess', listener: (event: BackgroundFetchEvent) => void): void;
    addEventListener(type: 'backgroundfetchfail', listener: (event: BackgroundFetchEvent) => void): void;
    addEventListener(type: 'backgroundfetchabort', listener: (event: BackgroundFetchEvent) => void): void;
    addEventListener(type: 'backgroundfetchclick', listener: (event: BackgroundFetchEvent) => void): void;
  }

  interface BackgroundFetchEvent extends Event {
    readonly registration: BackgroundFetchRegistration;
    updateUI(options: { title?: string }): Promise<void>;
  }
}

export {};
