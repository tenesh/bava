/**
 * Records the platform on the root element, so stylesheets can key platform
 * chrome off it, such as the macOS traffic-light inset in the title bar. Called
 * before the app mounts, so the first paint is already right.
 */
import type { Platform } from './shortcuts';

export function markPlatform(doc: Document, platform: Platform): void {
  doc.documentElement.dataset.platform = platform;
}
