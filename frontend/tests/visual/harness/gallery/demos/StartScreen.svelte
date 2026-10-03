<script lang="ts">
  import StartScreen from '../../../../../src/components/StartScreen.svelte';
  import Cell from '../Cell.svelte';
  import { RECENTS } from '../data';

  let { variant }: { variant: string } = $props();

  const recents = $derived(
    variant === 'empty'
      ? []
      : [
          { ...RECENTS[0], when: 'Today' },
          { ...RECENTS[1], when: 'Yesterday', missing: true },
          { ...RECENTS[2], when: '12 Sep' },
        ],
  );
</script>

<Cell name="nothing open" width="60rem" height="44rem">
  <StartScreen {recents} onNewSpace={() => {}} onOpenSpace={() => {}} onOpenFile={() => {}} onOpenRecent={() => {}} />
</Cell>
