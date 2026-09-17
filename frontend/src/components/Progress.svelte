<script lang="ts">
  /**
   * A progress bar, wrapping Ark's Progress.
   *
   * Indeterminate when `value` is null: use that whenever nothing reports real
   * progress, rather than inventing a percentage. It fills its container's
   * width unless the container sets `--progress-width`.
   */
  import { Progress } from '@ark-ui/svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** Accessible name. */
    label: string;
    /** 0 to 100, or null when progress is unknown. */
    value: number | null;
  };

  let { label, value }: Props = $props();
</script>

<!-- Ark names the bar from its translation, "loading..." by default. -->
<Progress.Root
  class="bava-progress"
  {value}
  translations={{
    value: (details) =>
      details.value === null ? label : t('progress.value').replace('{label}', label).replace('{percent}', String(details.percent)),
  }}
>
  <Progress.Track class="bava-progress-track">
    <Progress.Range class="bava-progress-range" />
  </Progress.Track>
</Progress.Root>

<style>
  :global(.bava-progress) {
    width: var(--progress-width, 100%);
  }

  :global(.bava-progress-track) {
    height: var(--size-progress-thickness);
    overflow: hidden;
    border-radius: var(--radius-full);
    background: var(--color-border-subtle);
  }

  :global(.bava-progress-range) {
    height: 100%;
    background: var(--color-accent);
  }

  :global(.bava-progress-range[data-state='indeterminate']) {
    width: 40%;
    animation: bava-progress-sweep var(--duration-indeterminate) var(--ease-in-out) infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.bava-progress-range[data-state='indeterminate']) {
      animation: none;
      margin-inline: auto;
    }
  }

  @keyframes -global-bava-progress-sweep {
    from {
      transform: translateX(-100%);
    }
    to {
      transform: translateX(250%);
    }
  }
</style>
