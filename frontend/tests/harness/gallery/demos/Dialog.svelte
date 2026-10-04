<script lang="ts">
  import Dialog from '../../../../src/components/Dialog.svelte';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
</script>

{#if variant === 'alert'}
  <Dialog bind:open title="Leave without saving?" variant="alert" onOpenChange={(next) => (open = next)}>
    <p class="text">An alert keeps a short question, its text and its buttons in one box.</p>
    <div class="buttons">
      <button type="button" class="bava-button">Cancel</button>
      <button type="button" class="bava-button danger">Leave</button>
    </div>
  </Dialog>
{:else}
  <Dialog bind:open title="Dialog title" subtitle="What the dialog is for" size="narrow" closable onOpenChange={(next) => (open = next)}>
    {#snippet actions()}
      <button type="button" class="bava-button ghost">Action</button>
    {/snippet}
    <p class="text">A ruled header with its subtitle, actions and close button, a padded body, and the buttons in a ruled footer.</p>
    {#snippet footer()}
      <button type="button" class="bava-button">Cancel</button>
      <button type="button" class="bava-button primary">Done</button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .text {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }
</style>
