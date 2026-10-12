/**
 * A name for a long task Go runs (an import, a zip, a PDF): `SpaceService.Cancel`
 * stops the run by it. Random, so a name stays unique when the page reloads
 * while Go keeps running.
 */
export function newRun(): string {
  return `run-${crypto.randomUUID()}`;
}
