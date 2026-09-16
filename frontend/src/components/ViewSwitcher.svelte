<script lang="ts">
  /** Document | Both | Canvas. */
  import Segments from './Segments.svelte';
  import { t } from '../i18n/t';
  import type { ViewMode } from '../shell/view.svelte';

  type Props = {
    value: ViewMode;
    onValueChange: (value: ViewMode) => void;
  };

  let { value, onValueChange }: Props = $props();

  const options: { value: ViewMode; label: string }[] = [
    { value: 'document', label: t('view.document') },
    { value: 'both', label: t('view.both') },
    { value: 'canvas', label: t('view.canvas') },
  ];
</script>

<Segments {value} {options} label={t('view.switcher')} {onValueChange} />
