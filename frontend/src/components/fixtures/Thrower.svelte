<script lang="ts">
  /** Test fixture: throws while rendering until `broken.value` is false. */
  type Props = { broken: { value: boolean } };
  let { broken }: Props = $props();

  function check(): string {
    if (broken.value) throw new Error('panel exploded');
    return 'panel content';
  }
</script>

<p class="child">{check()}</p>
