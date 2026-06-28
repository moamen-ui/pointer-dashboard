<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { confirmState, settleConfirm } from '@/composables/useConfirm';

const { t } = useI18n();

function onOpenChange(open: boolean) {
  if (!open) settleConfirm(false);
}
</script>

<template>
  <Dialog :open="confirmState.open" @update:open="onOpenChange">
    <DialogContent class="max-w-[440px]">
      <DialogHeader>
        <DialogTitle>{{ confirmState.title || t('common.confirm') }}</DialogTitle>
      </DialogHeader>
      <p class="whitespace-pre-line text-sm text-muted-foreground">
        {{ confirmState.message }}
      </p>
      <DialogFooter>
        <Button variant="outline" @click="settleConfirm(false)">
          {{ confirmState.cancelLabel || t('common.cancel') }}
        </Button>
        <Button
          :variant="confirmState.confirmVariant === 'destructive' ? 'destructive' : 'default'"
          @click="settleConfirm(true)"
        >
          {{ confirmState.confirmLabel || t('common.confirm') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
