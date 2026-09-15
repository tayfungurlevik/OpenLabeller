export {}

declare global {
  interface Window {
    api: {
      pickFolder: () => Promise<string | null>
      getBackendUrl: () => Promise<string>
    }
  }
}
