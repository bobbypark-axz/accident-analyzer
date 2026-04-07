declare global {
  interface Window { dataLayer: any[]; }
}

export function trackEvent(event: string, params?: Record<string, any>) {
  try {
    if (window.dataLayer && typeof window.dataLayer.push === 'function') {
      window.dataLayer.push({ event, ...params });
    }
  } catch (e) {
    // analytics should never break the app
  }
}
