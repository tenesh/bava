import { describe, expect, it, vi } from 'vitest';
import { importedText, type ImportBrought } from './import-links';

/** An import of one folder, `Notes`, picked from `/d/home/docs`. */
function folderImport(pages: ImportBrought['pages'], attached: Record<string, string> = {}): ImportBrought {
  return { origins: [{ path: '/d/home/docs/Notes', root: '/d/home/docs' }], pages, attached };
}

const none = vi.fn(async () => null);

describe('an imported page’s addresses', () => {
  it('point a picture beside the page at its attachment', async () => {
    const brought = folderImport([{ path: 'Marketing/Notes/Page.md', origin: 0, from: 'Notes/Page.md' }], { '0:Notes/chart.png': 'chart.png' });
    const text = '# Page\n\n![chart](chart.png)\n';
    expect(await importedText(brought.pages[0], text, brought, none)).toBe('# Page\n\n![chart](../../.bava/attachments/chart.png)\n');
  });

  it('point a picture in a subfolder at the name it landed with', async () => {
    const brought = folderImport([{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }], { '0:Notes/img/a.png': 'a 2.png' });
    expect(await importedText(brought.pages[0], '![](img/a.png)\n', brought, none)).toBe('![](../.bava/attachments/a%202.png)\n');
  });

  it('copy in a picture from outside the import', async () => {
    const brought = folderImport([{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }]);
    const attach = vi.fn(async () => 'x.png');
    expect(await importedText(brought.pages[0], '![](../../pics/x.png)\n', brought, attach)).toBe('![](../.bava/attachments/x.png)\n');
    expect(attach).toHaveBeenCalledWith('/d/home/pics/x.png');
  });

  it('copy in only a picture or a video, never a file named as one', async () => {
    const brought = folderImport([{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }]);
    const attach = vi.fn(async () => 'x');
    const text = '![](../../../.ssh/id_rsa)\n\n![](../../notes.txt)\n\n![](../../.hidden/x.png)\n';
    expect(await importedText(brought.pages[0], text, brought, attach)).toBeNull();
    expect(attach).not.toHaveBeenCalled();
  });

  it('never copy in through a backslash, which some systems read as a folder', async () => {
    const brought = folderImport([{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }]);
    const attach = vi.fn(async () => 'a.png');
    expect(await importedText(brought.pages[0], '![](x%5C.hidden%5Ca.png)\n\n![](<x\\.hidden\\b.png>)\n', brought, attach)).toBeNull();
    expect(attach).not.toHaveBeenCalled();
  });

  it('never read an address that climbs out of a zip as a file on disk', async () => {
    const brought: ImportBrought = { origins: [{ path: '/d/Export.zip', root: '' }], pages: [{ path: 'Page.md', origin: 0, from: 'Page.md' }], attached: {} };
    const attach = vi.fn(async () => 'x.png');
    expect(await importedText(brought.pages[0], '![](../etc/x.png)\n\n![](a/../../../x.png)\n', brought, attach)).toBeNull();
    expect(attach).not.toHaveBeenCalled();
  });

  it('never climb above the drive a page came from', async () => {
    const brought: ImportBrought = { origins: [{ path: 'C:\\docs\\Notes', root: 'C:\\docs' }], pages: [{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }], attached: {} };
    const attach = vi.fn(async () => 'x.png');
    expect(await importedText(brought.pages[0], '![](../../../x.png)\n', brought, attach)).toBeNull();
    expect(attach).not.toHaveBeenCalled();
    await importedText(brought.pages[0], '![](../pics/x.png)\n', brought, attach);
    expect(attach).toHaveBeenCalledWith('C:/docs/pics/x.png');
  });

  it('keep a picture Bava cannot reach as written', async () => {
    const brought = folderImport([{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }]);
    expect(await importedText(brought.pages[0], '![](../../pics/x.png)\n', brought, none)).toBeNull();
  });

  it("follow a zip's renamed attachments in a video's poster and its address", async () => {
    const brought: ImportBrought = {
      origins: [{ path: '/d/Export.zip', root: '' }],
      pages: [{ path: 'Old/Page.md', origin: 0, from: 'Page.md' }],
      attached: { '0:.bava/attachments/demo poster.png': 'demo poster 2.png', '0:.bava/attachments/demo.mp4': 'demo.mp4' },
    };
    const text = '<!-- bava: poster="demo poster.png" -->\n![Demo](.bava/attachments/demo.mp4)\n';
    expect(await importedText(brought.pages[0], text, brought, none)).toBe(
      '<!-- bava: poster="demo poster 2.png" -->\n![Demo](../.bava/attachments/demo.mp4)\n',
    );
  });

  it('follow a page of the same import that was numbered', async () => {
    const brought: ImportBrought = {
      origins: [
        { path: '/d/Launch plan.md', root: '/d' },
        { path: '/d/Notes.md', root: '/d' },
      ],
      pages: [
        { path: 'Marketing/Launch plan 2.md', origin: 0, from: 'Launch plan.md' },
        { path: 'Marketing/Notes.md', origin: 1, from: 'Notes.md' },
      ],
      attached: {},
    };
    expect(await importedText(brought.pages[1], 'See [the plan](Launch%20plan.md#dates).\n', brought, none)).toBe(
      'See [the plan](Launch%20plan%202.md#dates).\n',
    );
  });

  it('leave a link to a page outside the import alone', async () => {
    const brought = folderImport([{ path: 'Marketing/Notes/Page.md', origin: 0, from: 'Notes/Page.md' }]);
    expect(await importedText(brought.pages[0], '[road](../Roadmap.md) and [web](https://example.com)\n', brought, none)).toBeNull();
  });

  it('leave a page with nothing to rewrite byte for byte', async () => {
    const brought = folderImport([{ path: 'Notes/Page.md', origin: 0, from: 'Notes/Page.md' }]);
    expect(await importedText(brought.pages[0], '# Page\r\n\r\n*one*  \n', brought, none)).toBeNull();
  });
});
