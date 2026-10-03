<script lang="ts">
  import EmptyState from '../../../../../src/components/EmptyState.svelte';
  import Cell from '../Cell.svelte';
  import { LONG } from '../data';
</script>

<Cell name="title" width="16rem" height="9rem"><EmptyState title="No pages yet" /></Cell>
<Cell name="with body" width="16rem" height="9rem"><EmptyState title="No matches" body="Nothing in this Space has that name." /></Cell>
<Cell name="with mark" width="16rem" height="16rem"><EmptyState title="Nothing open" body="Open a page from Files." mark /></Cell>
<Cell name="with hints" width="16rem" height="16rem">
  <EmptyState title="An empty canvas" hints={[{ keys: 'R', label: 'Rectangle' }, { keys: 'T', label: 'Text' }, { keys: '/', label: 'Insert' }]} />
</Cell>
<Cell name="long text" width="16rem" height="16rem"><EmptyState title={LONG} body={`${LONG}, and then some more.`} /></Cell>
