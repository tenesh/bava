<script lang="ts">
  import OptionPicker from '../../../../src/components/OptionPicker.svelte';
  import { controlOptions } from '../../../../src/canvas/property-options';
  import type { PropertyValue } from '../../../../src/canvas/style';
  import { t } from '../../../../src/i18n/t';
  import Cell from '../Cell.svelte';

  const pickers = $state<{ name: string; id: string; current: PropertyValue | null | 'mixed' }[]>([
    { name: 'stroke width', id: 'strokeWidth', current: 2 },
    { name: 'arrowheads, some behind More', id: 'endArrowhead', current: 'arrow' },
    { name: 'mixed', id: 'strokeStyle', current: 'mixed' },
  ]);
</script>

{#each pickers as picker (picker.id)}
  {@const control = controlOptions({ id: picker.id })}
  <Cell name={picker.name}>
    <div class="bar">
      <OptionPicker label={t(control.labelKey)} icon={control.icon} options={control.options} current={picker.current} onSelect={(value) => (picker.current = value)} />
    </div>
  </Cell>
{/each}

<style>
  .bar {
    display: inline-flex;
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
  }
</style>
