<script lang="ts">
  import ConfirmDialog from '../../../../src/components/ConfirmDialog.svelte';

  let { variant }: { variant: string } = $props();

  let open = $state(true);

  const questions: Record<string, { title: string; body: string; options: { value: string; label: string; primary?: boolean }[] }> = {
    '': {
      title: 'Delete “Q3 retro” for good?',
      body: 'It leaves the Trash and cannot be restored.',
      options: [
        { value: 'cancel', label: 'Cancel' },
        { value: 'delete', label: 'Delete', tone: 'primary' },
      ],
    },
    three: {
      title: 'Save the changes to “Meeting notes from the quarterly planning offsite”?',
      body: 'The page has changes that are not saved. If you do not save them, they are lost when the page closes.',
      options: [
        { value: 'discard', label: 'Do not save' },
        { value: 'cancel', label: 'Cancel' },
        { value: 'save', label: 'Save', tone: 'primary' },
      ],
    },
  };

  // svelte-ignore state_referenced_locally
  const question = questions[variant] ?? questions[''];
</script>

<ConfirmDialog bind:open title={question.title} body={question.body} options={question.options} onChoose={() => {}} />
