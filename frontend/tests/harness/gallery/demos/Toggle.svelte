<script lang="ts">
  import Toggle from '../../../../src/components/Toggle.svelte';
  import Cell from '../Cell.svelte';

  const toggles = $state([
    { name: 'off', variant: 'inline' as const, checked: false, disabled: false },
    { name: 'on', variant: 'inline' as const, checked: true, disabled: false },
    { name: 'off, disabled', variant: 'inline' as const, checked: false, disabled: true },
    { name: 'on, disabled', variant: 'inline' as const, checked: true, disabled: true },
    { name: 'off, hovered', variant: 'inline' as const, checked: false, disabled: false, hover: true },
    { name: 'on, hovered', variant: 'inline' as const, checked: true, disabled: false, hover: true },
    { name: 'off, focused', variant: 'inline' as const, checked: false, disabled: false, focus: true },
    { name: 'row, off', variant: 'row' as const, checked: false, disabled: false },
    { name: 'row, on', variant: 'row' as const, checked: true, disabled: false },
    { name: 'row, disabled', variant: 'row' as const, checked: false, disabled: true },
  ]);
</script>

{#each toggles as toggle (toggle.name)}
  <Cell
    name={toggle.name}
    width={toggle.variant === 'row' ? '16rem' : undefined}
    target={toggle.hover ? '.bava-toggle-track' : toggle.focus ? 'input' : undefined}
    attrs={toggle.hover ? { 'data-hover': '' } : undefined}
    force={toggle.focus ? 'focus' : undefined}
  >
    <Toggle label="Snap to objects" variant={toggle.variant} checked={toggle.checked} disabled={toggle.disabled} onChange={(next) => (toggle.checked = next)} />
  </Cell>
{/each}
