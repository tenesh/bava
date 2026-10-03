<script lang="ts">
  import ErrorDialog from '../../../../../src/components/ErrorDialog.svelte';
  import { t } from '../../../../../src/i18n/t';
  import { bodyKeyFor } from '../../../../../src/shell/errors.svelte';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
  const details = $derived(variant === 'plain' ? '' : `${t('error.id')}: e-7f3a91\n${t('error.kind')}: panic\n${t('error.previousLog')}: 2026-09-27T11-58-02.log`);
</script>

<ErrorDialog
  bind:open
  title={t('error.unexpected.title')}
  body={t(bodyKeyFor({ kind: 'unexpected', details }))}
  {details}
  onCopyDetails={() => {}}
  onOpenLogs={() => {}}
  onClose={() => {}}
/>
