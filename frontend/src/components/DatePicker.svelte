<script lang="ts">
  /**
   * A calendar under a date chip: the chip's month with its day chosen; a
   * pick gives the day as `YYYY-MM-DD`. Escape, or a press outside it, closes
   * it.
   *
   * Presentational: the caller changes the chip.
   */
  import { DatePicker, Portal, parseDate } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import { t } from '../i18n/t';

  type Props = {
    /** The chip on screen; the calendar sits below it. */
    at: { left: number; bottom: number };
    /** The chip's day, `YYYY-MM-DD`. */
    value: string;
    onPick: (day: string) => void;
    onClose: () => void;
  };

  let { at, value, onPick, onClose }: Props = $props();

  let panel: HTMLDivElement | undefined = $state();

  // Focus on the chip's day, so the arrow keys move through the month.
  $effect(() => {
    panel?.querySelector<HTMLElement>('[data-selected]')?.focus();
  });

  $effect(() => {
    const away = (event: PointerEvent) => {
      if (panel && !panel.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape, true);
    };
  });
</script>

<Portal container={portalRoot()}>
  <div
    bind:this={panel}
    class="date-picker"
    role="dialog"
    aria-label={t('date.label')}
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
  >
    <DatePicker.Root
      inline
      locale="en-GB"
      defaultValue={[parseDate(value)]}
      onValueChange={(details) => {
        const day = details.value[0];
        if (day) onPick(day.toString());
      }}
    >
      <DatePicker.View view="day">
        <DatePicker.Context>
          {#snippet render(api)}
            <DatePicker.ViewControl class="view-control">
              <DatePicker.PrevTrigger class="bava-button ghost step" aria-label={t('date.previous')}>‹</DatePicker.PrevTrigger>
              <span class="month">{api().visibleRangeText.start}</span>
              <DatePicker.NextTrigger class="bava-button ghost step" aria-label={t('date.next')}>›</DatePicker.NextTrigger>
            </DatePicker.ViewControl>
            <DatePicker.Table class="days">
              <DatePicker.TableHead>
                <DatePicker.TableRow>
                  {#each api().weekDays as weekDay, index (index)}
                    <DatePicker.TableHeader class="weekday">{weekDay.narrow}</DatePicker.TableHeader>
                  {/each}
                </DatePicker.TableRow>
              </DatePicker.TableHead>
              <DatePicker.TableBody>
                {#each api().weeks as week, index (index)}
                  <DatePicker.TableRow>
                    {#each week as day (day.toString())}
                      <DatePicker.TableCell value={day}>
                        <DatePicker.TableCellTrigger class="day">{day.day}</DatePicker.TableCellTrigger>
                      </DatePicker.TableCell>
                    {/each}
                  </DatePicker.TableRow>
                {/each}
              </DatePicker.TableBody>
            </DatePicker.Table>
          {/snippet}
        </DatePicker.Context>
      </DatePicker.View>
    </DatePicker.Root>
  </div>
</Portal>

<style>
  .date-picker {
    position: fixed;
    z-index: var(--z-portal);
    padding: var(--space-2);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }

  .date-picker :global(.view-control) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-1);
  }

  .month {
    font-size: var(--text-control);
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
  }

  .date-picker :global(.days) {
    border-collapse: collapse;
  }

  .date-picker :global(.weekday) {
    width: var(--size-date-cell);
    font-size: var(--text-meta);
    font-weight: var(--weight-regular);
    color: var(--color-text-muted);
  }

  .date-picker :global(.day) {
    width: var(--size-date-cell);
    height: var(--size-date-cell);
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-primary);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .date-picker :global(.day:hover) {
    background: var(--color-control-hover);
  }

  .date-picker :global(.day[data-outside-range]) {
    color: var(--color-text-faint);
  }

  .date-picker :global(.day[data-today]) {
    font-weight: var(--weight-semibold);
  }

  .date-picker :global(.day:active) {
    background: var(--color-control-active);
  }

  .date-picker :global(.day[data-selected]) {
    color: var(--color-accent-contrast);
    background: var(--color-accent);
  }

  .date-picker :global(.day:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }
</style>
