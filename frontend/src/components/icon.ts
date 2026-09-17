/**
 * Icon sizing.
 *
 * A string union rather than a number, so an icon cannot quietly acquire a
 * size that is not on the scale. No icon set is bundled yet (Milestone 9 does
 * that), so the component takes an SVG path and renders it.
 */
export type IconSize = 'sm' | 'md' | 'lg';

const SIZES: Record<IconSize, string> = {
  sm: 'var(--space-3)',
  md: 'var(--space-4)',
  lg: 'var(--space-5)',
};

export function iconSizeVar(size: IconSize): string {
  return SIZES[size];
}
