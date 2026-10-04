<script lang="ts">
  import ShortcutsDialog from '../../../../src/components/ShortcutsDialog.svelte';
  import { shortcutGroups, type MenuSpec } from '../../../../src/shell/shortcuts';
  import { t } from '../../../../src/i18n/t';
  import menuSpec from '../../../../../internal/app/menu/spec.json';

  let open = $state(true);
</script>

<ShortcutsDialog bind:open title={t('shortcuts.title')} groups={shortcutGroups(menuSpec as MenuSpec, 'darwin')} onOpenChange={(next) => (open = next)} />
