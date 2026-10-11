<script lang="ts">
  /**
   * A number typed into a field, wrapping Ark's NumberInput: named by its
   * label for a screen reader, and reporting each valid number typed.
   */
  import { NumberInput } from '@ark-ui/svelte';

  type Props = {
    /** Its name for a screen reader. */
    label: string;
    value: number;
    min?: number;
    step?: number;
    onValueChange: (value: number) => void;
  };

  let { label, value, min = 0, step = 1, onValueChange }: Props = $props();
</script>

<NumberInput.Root
  class="bava-number-field"
  value={String(value)}
  {min}
  {step}
  formatOptions={{ useGrouping: false, maximumFractionDigits: 2 }}
  onValueChange={(details) => {
    if (Number.isFinite(details.valueAsNumber)) onValueChange(details.valueAsNumber);
  }}
>
  <NumberInput.Input class="bava-field bava-number-input" aria-label={label} />
</NumberInput.Root>

<style>
  :global(.bava-number-field) {
    display: flex;
    min-width: 0;
  }

  :global(.bava-number-input.bava-field) {
    width: 100%;
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    font-variant-numeric: tabular-nums;
  }
</style>
