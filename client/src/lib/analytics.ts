/**
 * Analytics utility for tracking custom events
 * Uses Umami analytics API
 */

interface EventData {
  [key: string]: string | number | boolean;
}

/**
 * Track a custom event
 * @param eventName - Name of the event
 * @param eventData - Additional data to track with the event
 */
export function trackEvent(eventName: string, eventData?: EventData) {
  // Check if umami is available
  if (typeof window !== 'undefined' && (window as any).umami) {
    try {
      (window as any).umami.track(eventName, eventData);
      console.log(`[Analytics] Event tracked: ${eventName}`, eventData);
    } catch (error) {
      console.error('[Analytics] Failed to track event:', error);
    }
  }
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
