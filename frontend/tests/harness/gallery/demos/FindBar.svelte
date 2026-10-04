<script lang="ts">
  import FindBar from '../../../../src/components/FindBar.svelte';
  import Cell from '../Cell.svelte';

  // The page searched: the matches are counted in it, as the editor counts them.
  const PAGE = 'The plan names its owner, the plan date and the plan budget.';

  let query = $state('');
  let index = $state(0);
  const count = $derived(query ? PAGE.toLowerCase().split(query.toLowerCase()).length - 1 : 0);
</script>

<Cell name="over the page" width="48rem">
  <FindBar
    {count}
    index={count === 0 ? -1 : index}
    focus={{ field: 'find', at: 0 }}
    onFind={(text) => {
      query = text;
      index = 0;
    }}
    onNext={() => (index = (index + 1) % Math.max(1, count))}
    onPrevious={() => (index = (index - 1 + count) % Math.max(1, count))}
    onReplace={() => {}}
    onReplaceAll={() => {}}
    onClose={() => {}}
  />
</Cell>
