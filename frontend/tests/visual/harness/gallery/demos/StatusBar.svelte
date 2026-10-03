<script lang="ts">
  import StatusBar from '../../../../../src/components/StatusBar.svelte';
  import Cell from '../Cell.svelte';
</script>

<div class="column">
  <Cell name="the canvas" width="44rem"><StatusBar space="Acme Product" path="Engineering/Architecture.md" engine="TALA" nodes={12} /></Cell>
  <Cell name="the document" width="44rem"><StatusBar space="Acme Product" path="Roadmap.md" words={1284} characters={7311} /></Cell>
  <Cell name="one word" width="44rem"><StatusBar space="Acme Product" path="Roadmap.md" words={1} characters={1} /></Cell>
  <Cell name="with a message" width="44rem"><StatusBar space="Acme Product" path="Roadmap.md" words={312} characters={1800} message="Autosave paused: the file changed on disk" /></Cell>
  <Cell name="nothing open" width="44rem"><StatusBar /></Cell>
  <Cell name="a long path" width="44rem">
    <StatusBar space="Acme Product" path="/Users/you/Library/Mobile Documents/com~apple~CloudDocs/Work/Clients/Acme/Planning/Quarterly planning notes.md" words={40} characters={220} />
  </Cell>
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
  }
</style>
