/**
 * The diagram canvas.
 *
 * A plain class, not a Svelte component. It is mounted once into a div and
 * owns the DOM inside it, patching itself when a new render result arrives.
 * Svelte never renders diagram nodes: per-node components would reconcile the
 * whole tree on every pan, zoom or keystroke, and the app would stutter at a
 * few hundred nodes. When that happens the instinct is to blame the webview;
 * it is this.
 *
 * Data flows in through setSVG, events flow out. No reactive state holds
 * geometry.
 */
export class DiagramCanvas {
  #host: HTMLElement | null = null;
  #svg = '';
  /** An SVG that arrived before the canvas had somewhere to paint it. */
  #pending = '';

  /** Attach to the element the component owns. Call once, from onMount. */
  mount(host: HTMLElement): void {
    this.#host = host;
    host.replaceChildren();
    if (this.#pending !== '') {
      const svg = this.#pending;
      this.#pending = '';
      this.setSVG(svg);
    }
  }

  /**
   * Patch in a newly rendered diagram.
   *
   * An empty string is ignored: a compile error must leave the last good
   * diagram on screen, because users type through invalid states constantly.
   */
  setSVG(svg: string): void {
    if (svg === '') return;
    // The host check comes before the cache is written. Caching an SVG that was
    // never painted means the same SVG arriving after mount is treated as
    // already on screen, and the canvas stays blank until the source changes.
    if (!this.#host) {
      this.#pending = svg;
      return;
    }
    if (svg === this.#svg) return;
    this.#svg = svg;
    // The SVG arrives without an XML declaration precisely so it can go in here.
    this.#host.innerHTML = svg;
  }

  /** The SVG currently on screen. */
  get svg(): string {
    return this.#svg;
  }

  /**
   * Resolve a click target to the diagram node that contains it, so a caller
   * can look the id up in the render response's nodeMap and jump to source.
   * Returns null when the target is not part of a node.
   */
  nodeIDForTarget(target: Element | null): string | null {
    for (let node = target; node && node !== this.#host; node = node.parentElement) {
      const id = node.id;
      // The root <svg> carries an id too; it is not a diagram node.
      if (id && node.tagName.toLowerCase() !== 'svg') return id;
    }
    return null;
  }

  /** Release the DOM. Call from the component's cleanup return. */
  destroy(): void {
    this.#host?.replaceChildren();
    this.#host = null;
    this.#svg = '';
    this.#pending = '';
  }
}
