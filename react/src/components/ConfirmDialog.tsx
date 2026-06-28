// React equivalent of angular's shared ConfirmDialogComponent (a MatDialog).
// Controlled by an `open` boolean; resolves via onConfirm/onCancel. Used for
// destructive confirmations (disable / reject) so we never use window.confirm.
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ConfirmDialogProps {
  open: boolean;
  message: string;
  /** i18n-resolved label for the confirm button. Defaults to common.confirm. */
  confirmLabel?: string;
  /** When 'warn', the confirm button is rendered destructive. */
  confirmColor?: 'primary' | 'warn';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  message,
  confirmLabel,
  confirmColor = 'primary',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('common.confirm')}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={confirmColor === 'warn' ? 'destructive' : 'default'}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
