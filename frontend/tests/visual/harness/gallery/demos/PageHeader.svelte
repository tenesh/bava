<script lang="ts">
  import PageHeader from '../../../../../src/components/PageHeader.svelte';
  import Cell from '../Cell.svelte';
  import { LONG } from '../data';
</script>

<div class="column">
  <Cell name="a page in a folder" width="28rem"><PageHeader crumbs={['Engineering', 'Architecture']} locked={false} onMenu={() => {}} /></Cell>
  <Cell name="locked" width="28rem"><PageHeader crumbs={['Roadmap']} locked onMenu={() => {}} /></Cell>
  <Cell name="long folders" width="28rem"><PageHeader crumbs={['Research and development', 'Customer interviews', 'Week one notes']} locked onMenu={() => {}} /></Cell>
  <Cell name="long" width="28rem"><PageHeader crumbs={['Research', 'Interviews', LONG]} locked onMenu={() => {}} /></Cell>
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
  }
</style>
