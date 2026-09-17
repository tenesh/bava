<script lang="ts">
  /** Test fixture: an InsertPanel over fresh insert state. */
  import InsertPanel from '../InsertPanel.svelte';
  import { createInsert, type InsertOutcome } from '../../shell/insert.svelte';

  type Props = { onOutcome: (outcome: InsertOutcome) => void };
  let { onOutcome }: Props = $props();
  const insert = createInsert();
</script>

<InsertPanel {insert} {onOutcome} />
