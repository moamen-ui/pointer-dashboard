<script setup lang="ts">
import {
  SwitchRoot,
  type SwitchRootEmits,
  type SwitchRootProps,
  SwitchThumb,
  useForwardPropsEmits,
} from 'reka-ui';
import { cn } from '@/lib/utils';

const props = defineProps<SwitchRootProps & { class?: string }>();
const emits = defineEmits<SwitchRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <SwitchRoot
    v-bind="forwarded"
    :class="
      cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        // Real (non-rem) pixel sizing below md: the root's 14px font-size
        // scales every rem-based h-*/w-* utility to 0.875x nominal (see
        // DESIGN.md's root-size note), which would still leave an h-10/w-10
        // switch just under the 32px touch-target floor. Arbitrary `[Npx]`
        // values sidestep that scaling for this one control.
        'max-md:h-[32px] max-md:w-[56px]',
        props.class,
      )
    "
  >
    <SwitchThumb
      class="pointer-events-none block h-4 w-4 rounded-full bg-background ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0 rtl:data-[state=checked]:-translate-x-4 max-md:h-[26px] max-md:w-[26px] max-md:data-[state=checked]:translate-x-[26px] max-md:data-[state=unchecked]:translate-x-0 max-md:rtl:data-[state=checked]:-translate-x-[26px]"
    />
  </SwitchRoot>
</template>
