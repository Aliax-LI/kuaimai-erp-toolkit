export type { KuaimaiApi } from './apis/build-api';

declare global {
  interface Window {
    kuaimai: import('./apis/build-api').KuaimaiApi;
  }
}

export {};
