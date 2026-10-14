/**
 * The line under the diagram preview: which engine laid it out, how many
 * shapes it holds, and any icons Bava does not have (their shapes stay
 * plain; nothing is fetched). Empty while nothing is laid out.
 */
import { t } from '../i18n/t';
import { ENGINE_NAMES, type LayoutEngine } from '../settings/layout-engine';

export function d2DiagramStatus(engine: LayoutEngine, shapes: number, iconsMissing: string[] = []): string {
  if (shapes <= 0) return '';
  const line = shapes === 1 ? t('d2Diagram.status.one') : t('d2Diagram.status').replace('{shapes}', String(shapes));
  const status = line.replace('{engine}', ENGINE_NAMES[engine]);
  if (iconsMissing.length === 0) return status;
  const names = iconsMissing.join(t('d2Diagram.iconSeparator'));
  const missing = (iconsMissing.length === 1 ? t('d2Diagram.iconMissing') : t('d2Diagram.iconsMissing')).replace('{names}', names);
  return t('d2Diagram.statusWithIcons').replace('{status}', status).replace('{icons}', missing);
}
