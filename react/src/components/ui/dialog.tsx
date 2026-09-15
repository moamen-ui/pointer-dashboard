import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Desktop: unchanged centered panel. Below `md` this becomes a full-width,
        // bottom-anchored sheet (DESIGN.md target: "Detail/edit dialogs → full-height
        // sheet below md") — the sheet itself is the single scroll container so a
        // sticky header/footer (see DialogHeader/DialogFooter below) can pin to its
        // top/bottom while the content between them scrolls. Parity note: Angular/Vue
        // apply the identical max-md: geometry to their dialog primitive.
        'fixed start-[50%] top-[50%] z-50 grid w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 rtl:translate-x-[50%] rounded-lg border border-border bg-card p-6 shadow-dialog duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'max-md:start-0 max-md:end-0 max-md:top-auto max-md:bottom-0 max-md:w-full max-md:max-w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rtl:translate-x-0 max-md:flex max-md:max-h-[100dvh] max-md:flex-col max-md:overflow-y-auto max-md:rounded-b-none max-md:rounded-t-xl max-md:px-4 max-md:py-0 max-md:gap-0',
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close className="absolute end-4 top-4 max-md:end-3 max-md:top-3 max-md:z-20 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-start',
      // Sticks to the top of the mobile sheet's own scroll container so the title
      // stays visible while the body scrolls under it.
      'max-md:sticky max-md:top-0 max-md:-mx-4 max-md:z-10 max-md:shrink-0 max-md:bg-card max-md:px-4 max-md:pb-3 max-md:pe-10 max-md:pt-4',
      className,
    )}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      // Footer actions stack full-width and pin to the bottom of the sheet.
      'max-md:sticky max-md:bottom-0 max-md:-mx-4 max-md:z-10 max-md:mt-auto max-md:flex-col-reverse max-md:gap-2 max-md:space-x-0 max-md:border-t max-md:border-border max-md:bg-card max-md:px-4 max-md:py-3 max-md:[&>button]:min-h-11 max-md:[&>button]:w-full',
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
