/**
 * The line under the diagram preview: which engine laid it out, and how many
 * shapes it holds. Empty while nothing is laid out.
 */
import { t } from '../i18n/t';
import { ENGINE_NAMES, type LayoutEngine } from '../settings/layout-engine';

export function diagramStatus(engine: LayoutEngine, shapes: number): string {
  if (shapes <= 0) return '';
  const line = shapes === 1 ? t('diagram.status.one') : t('diagram.status').replace('{shapes}', String(shapes));
  return line.replace('{engine}', ENGINE_NAMES[engine]);
}
