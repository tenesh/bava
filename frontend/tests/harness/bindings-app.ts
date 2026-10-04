/**
 * Stands in for the generated `internal/app` bindings in the browser tests
 * (`vite.visual.config.ts` points the import here). One set of fakes for the
 * page, reachable from the walks as `window.__bava.fakes`.
 */
import { createFakes } from './fake-services';

export const fakes = createFakes();
export const { ExportService, FileService, LogService, MenuService, RenderService, SpaceService } = fakes;
