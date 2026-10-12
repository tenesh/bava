import { describe, expect, it } from 'vitest';
import { withoutRemoteRefs } from './safe-svg';

// Bava makes no network calls the user did not configure (CLAUDE.md,
// non-negotiable 1). D2 puts a remote URL in its output for `icon:` and
// `link:`, and injecting that into the webview would fetch it as the user
// types, and could navigate the app window away on a click.
describe('previewing rendered SVG safely', () => {
  it('drops an image that would be fetched', () => {
    const svg = withoutRemoteRefs('<svg><image href="https://icons.terrastruct.com/aws.svg"/></svg>');
    expect(svg).not.toContain('https://icons.terrastruct.com');
  });

  it('drops a link that would navigate the window', () => {
    const svg = withoutRemoteRefs('<svg><a href="https://example.com"><rect/></a></svg>');
    expect(svg).not.toContain('https://example.com');
    // The shape it wrapped is still drawn.
    expect(svg).toContain('<rect/>');
  });

  it('leaves the diagram alone, including its own fragment references', () => {
    const svg = '<svg><use href="#shape-1"/><path d="M0 0"/><style>.a{fill:red}</style></svg>';
    expect(withoutRemoteRefs(svg)).toBe(svg);
  });

  it('drops every protocol that reaches outside the app', () => {
    for (const url of ['http://x/y.png', 'https://x/y.png', '//x/y.png', 'data:text/html;base64,abc']) {
      const svg = withoutRemoteRefs(`<svg><image href="${url}"/></svg>`);
      expect(svg).not.toContain(url);
    }
  });

  it('is not fooled by spacing or case', () => {
    const svg = withoutRemoteRefs('<svg><image  HREF = "HTTPS://x/y.png" /></svg>');
    expect(svg.toLowerCase()).not.toContain('https://x');
  });

  // A picture on the canvas, previewed for export: its bytes are already in
  // the document, so nothing is fetched.
  it('keeps a PNG picture carried inside the document as data, and no other kind', () => {
    const png = '<svg><image href="data:image/png;base64,iVBORw0KGgo="/></svg>';
    expect(withoutRemoteRefs(png)).toBe(png);
    for (const url of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png,raw', 'data:text/html;base64,abc']) {
      expect(withoutRemoteRefs(`<svg><image href="${url}"/></svg>`)).not.toContain(url);
    }
  });
});

