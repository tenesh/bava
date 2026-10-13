/** The bundled icon sets, made at build time by `tooling/icon-sets.ts`. */
declare module 'virtual:bava-icons/*' {
  const icons: { name: string; body: string; keywords: string[]; title?: string; hex?: string }[];
  export default icons;
}
