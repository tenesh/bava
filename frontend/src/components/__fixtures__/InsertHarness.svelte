<script lang="ts">
  /** Test fixture: an InsertPanel over fresh insert state, its icon picker over a few icons. */
  import InsertPanel from '../InsertPanel.svelte';
  import { createInsert, type InsertOutcome } from '../../shell/insert.svelte';
  import { createIconPicker } from '../../shell/icon-picker.svelte';
  import type { BundledSet, IconEntry } from '../../canvas/icons/sets';

  type Props = { onOutcome: (outcome: InsertOutcome) => void; failLogos?: boolean };
  let { onOutcome, failLogos = false }: Props = $props();
  const insert = createInsert();
  const icon = (set: IconEntry['set'], name: string, title = name): IconEntry => ({
    set,
    name,
    title,
    keywords: [],
    body: '<path d="M4 6h16"/>',
  });
  const SETS: Record<BundledSet, IconEntry[]> = {
    line: [icon('line', 'database'), icon('line', 'server')],
    solid: [icon('solid', 'database')],
    logo: [icon('logo', 'postgresql', 'PostgreSQL')],
  };
  const icons = createIconPicker({
    load: async (set) => {
      if (set === 'logo' && failLogos) throw new Error('gone');
      return SETS[set];
    },
    custom: () => [],
  });
</script>

<InsertPanel {insert} {icons} {onOutcome} />
