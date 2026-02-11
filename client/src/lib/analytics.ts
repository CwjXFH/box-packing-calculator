/**
 * Analytics utility for tracking custom events with offline support
 * Uses Umami analytics API with IndexedDB caching for offline events
 */

interface EventData {
  [key: string]: string | number | boolean;
}

interface CachedEvent {
  id: string;
  eventName: string;
  eventData?: EventData;
  timestamp: number;
}

// IndexedDB configuration
const DB_NAME = 'analytics-cache';
const DB_VERSION = 1;
const STORE_NAME = 'events';
const MAX_CACHED_EVENTS = 1000;

/**
 * Initialize IndexedDB for offline event caching
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Save event to IndexedDB cache
 */
async function cacheEvent(eventName: string, eventData?: EventData): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const event: CachedEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventName,
      eventData,
      timestamp: Date.now(),
    };

    store.add(event);

    // Check cache size and remove oldest events if exceeds limit
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > MAX_CACHED_EVENTS) {
        const index = store.index('timestamp');
        const cursorRequest = index.openCursor();
        let deleteCount = countRequest.result - MAX_CACHED_EVENTS;

        cursorRequest.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest).result;
          if (cursor && deleteCount > 0) {
            store.delete(cursor.primaryKey);
            deleteCount--;
            cursor.continue();
          }
        };
      }
    };

    console.log(`[Analytics] Event cached offline: ${eventName}`, eventData);
  } catch (error) {
    console.error('[Analytics] Failed to cache event:', error);
  }
}

/**
 * Get all cached events from IndexedDB
 */
async function getCachedEvents(): Promise<CachedEvent[]> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[Analytics] Failed to get cached events:', error);
    return [];
  }
}

/**
 * Clear cached events from IndexedDB
 */
async function clearCachedEvents(eventIds: string[]): Promise<void> {
  try {
    const db = await initDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    for (const id of eventIds) {
      store.delete(id);
    }

    console.log(`[Analytics] Cleared ${eventIds.length} cached events`);
  } catch (error) {
    console.error('[Analytics] Failed to clear cached events:', error);
  }
}

/**
 * Send event to Umami analytics
 */
function sendEvent(eventName: string, eventData?: EventData): boolean {
  if (typeof window !== 'undefined' && (window as any).umami) {
    try {
      (window as any).umami.track(eventName, eventData);
      console.log(`[Analytics] Event sent: ${eventName}`, eventData);
      return true;
    } catch (error) {
      console.error('[Analytics] Failed to send event:', error);
      return false;
    }
  }
  return false;
}

/**
 * Flush cached events to analytics server
 */
async function flushCachedEvents(): Promise<void> {
  if (!navigator.onLine) {
    console.log('[Analytics] Still offline, skipping flush');
    return;
  }

  const cachedEvents = await getCachedEvents();
  if (cachedEvents.length === 0) {
    return;
  }

  console.log(`[Analytics] Flushing ${cachedEvents.length} cached events`);

  const successfulIds: string[] = [];

  for (const event of cachedEvents) {
    const success = sendEvent(event.eventName, event.eventData);
    if (success) {
      successfulIds.push(event.id);
    }
  }

  if (successfulIds.length > 0) {
    await clearCachedEvents(successfulIds);
    console.log(`[Analytics] Successfully flushed ${successfulIds.length} events`);
  }
}

/**
 * Track a custom event with offline support
 * @param eventName - Name of the event
 * @param eventData - Additional data to track with the event
 */
export function trackEvent(eventName: string, eventData?: EventData) {
  if (navigator.onLine) {
    // Online: try to send immediately
    const success = sendEvent(eventName, eventData);
    if (!success) {
      // Failed to send, cache it
      cacheEvent(eventName, eventData);
    }
  } else {
    // Offline: cache the event
    cacheEvent(eventName, eventData);
  }
}

/**
 * Initialize analytics system with offline support
 * Call this once when the app starts
 */
export function initAnalytics() {
  // Flush cached events on page load if online
  if (navigator.onLine) {
    flushCachedEvents();
  }

  // Listen for online event to flush cached events
  window.addEventListener('online', () => {
    console.log('[Analytics] Network connection restored, flushing cached events');
    flushCachedEvents();
  });

  // Periodically try to flush events (every 5 minutes)
  setInterval(() => {
    if (navigator.onLine) {
      flushCachedEvents();
    }
  }, 5 * 60 * 1000);

  console.log('[Analytics] Offline support initialized');
}

/**
 * Track calculation event
 */
export function trackCalculation(data: {
  mode: 'mixed' | 'single';
  bigBoxVolume: number;
  smallBoxVolume: number;
  boxCount: number;
  utilization: number;
  actualWeight: number;
  volumetricWeight: number;
}) {
  trackEvent('calculation', {
    mode: data.mode,
    big_box_volume: Math.round(data.bigBoxVolume),
    small_box_volume: Math.round(data.smallBoxVolume),
    box_count: data.boxCount,
    utilization: Math.round(data.utilization * 100) / 100,
    actual_weight_kg: Math.round(data.actualWeight * 100) / 100,
    volumetric_weight_kg: Math.round(data.volumetricWeight * 100) / 100,
  });
}

/**
 * Track algorithm mode toggle
 */
export function trackModeToggle(mode: 'mixed' | 'single') {
  trackEvent('mode_toggle', {
    new_mode: mode,
  });
}

/**
 * Track thickness adjustment
 */
export function trackThicknessAdjustment(thickness: number) {
  trackEvent('thickness_adjustment', {
    thickness_cm: thickness,
  });
}

/**
 * Track volumetric weight divisor adjustment
 */
export function trackDivisorAdjustment(divisor: number) {
  trackEvent('divisor_adjustment', {
    divisor: divisor,
  });
}

/**
 * Track optimization suggestion applied
 */
export function trackOptimizationApplied(data: {
  originalVolume: number;
  optimizedVolume: number;
  utilizationImprovement: number;
}) {
  trackEvent('optimization_applied', {
    original_volume: Math.round(data.originalVolume),
    optimized_volume: Math.round(data.optimizedVolume),
    utilization_improvement: Math.round(data.utilizationImprovement * 100) / 100,
  });
}

/**
 * Track PWA installation
 */
export function trackPWAInstall() {
  trackEvent('pwa_install');
}

/**
 * Track PWA install prompt dismissed
 */
export function trackPWADismiss() {
  trackEvent('pwa_dismiss');
}
