import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Compass, ArrowRight, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTour } from '@/lib/tour';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export function TourSpotlight() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const {
    isOpen,
    promptOpen,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    endTour,
    startTour,
    dismissPrompt,
  } = useTour();

  const [rect, setRect] = useState<TargetRect | null>(null);

  // Update target rect with retry if DOM element is still mounting
  const updateRect = useCallback(() => {
    if (!isOpen || !currentStep) {
      setRect(null);
      return;
    }

    const el = document.querySelector(currentStep.targetSelector);
    if (!el) {
      // Element not yet in DOM, retry shortly
      const timer = setTimeout(() => {
        const retryEl = document.querySelector(currentStep.targetSelector);
        if (retryEl) {
          retryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const r = retryEl.getBoundingClientRect();
          setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [isOpen, currentStep]);

  useEffect(() => {
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [updateRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') endTour();
      else if (e.key === 'ArrowRight') (isRtl ? prevStep : nextStep)();
      else if (e.key === 'ArrowLeft') (isRtl ? nextStep : prevStep)();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, endTour, nextStep, prevStep, isRtl]);

  // Floating card coordinate calculation
  const getCardStyle = () => {
    if (!rect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    const pad = 12;
    const cardWidth = 360;
    const cardHeight = 220;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = rect.top + rect.height + pad;
    let left = rect.left;

    // Adjust if card overflows bottom
    if (top + cardHeight > viewportH - 20) {
      top = Math.max(20, rect.top - cardHeight - pad);
    }

    // Adjust horizontal position
    if (left + cardWidth > viewportW - 20) {
      left = Math.max(20, viewportW - cardWidth - 20);
    }
    if (left < 20) left = 20;

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
    };
  };

  const isLastStep = currentStepIndex === totalSteps - 1;
  const pad = 6;

  return (
    <>
      {/* 1. Initial Welcome Prompt Dialog */}
      <Dialog open={promptOpen} onOpenChange={(o) => !o && dismissPrompt()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-brand" />
              {t('tour.welcomePromptTitle')}
            </DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed text-muted-foreground">
              {t('tour.welcomePromptDesc')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 flex gap-2 sm:justify-end">
            <Button variant="outline" onClick={dismissPrompt}>
              {t('tour.skipTour')}
            </Button>
            <Button onClick={startTour} className="gap-1.5">
              <Compass className="h-4 w-4" />
              {t('tour.startTour')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Interactive Spotlight Tour Overlay */}
      {isOpen && currentStep && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* SVG Dimming Mask */}
          <svg className="absolute inset-0 h-full w-full pointer-events-auto">
            <defs>
              <mask id="tour-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {rect && (
                  <rect
                    x={rect.left - pad}
                    y={rect.top - pad}
                    width={rect.width + pad * 2}
                    height={rect.height + pad * 2}
                    rx="8"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.72)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>

          {/* Highlight ring around target element */}
          {rect && (
            <div
              className="pointer-events-none absolute rounded-lg border-2 border-brand shadow-[0_0_15px_rgba(var(--brand-rgb,59,130,246),0.5)] transition-all duration-300"
              style={{
                top: `${rect.top - pad}px`,
                left: `${rect.left - pad}px`,
                width: `${rect.width + pad * 2}px`,
                height: `${rect.height + pad * 2}px`,
              }}
            />
          )}

          {/* Floating Popover Step Card */}
          <div
            className="absolute z-50 w-[360px] max-w-[calc(100vw-40px)] rounded-xl border border-border bg-card p-4.5 shadow-2xl transition-all duration-200"
            style={getCardStyle()}
          >
            {/* Header: step counter & close */}
            <div className="flex items-center justify-between pb-2 border-b border-border/60">
              <span className="text-[0.75rem] font-semibold uppercase tracking-wider text-brand">
                {t('tour.stepCount', {
                  current: currentStepIndex + 1,
                  total: totalSteps,
                })}
              </span>
              <button
                type="button"
                onClick={endTour}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={t('tour.skipTour')}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="mt-3">
              <h4 className="text-sm font-semibold text-foreground">
                {t(currentStep.titleKey)}
              </h4>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                {t(currentStep.descriptionKey)}
              </p>
            </div>

            {/* Actions */}
            <div className="mt-4 flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={endTour}
              >
                {t('tour.skipTour')}
              </Button>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <Button variant="outline" size="sm" onClick={prevStep} className="h-8 text-xs">
                    {isRtl ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
                    {t('tour.back')}
                  </Button>
                )}

                <Button size="sm" onClick={nextStep} className="h-8 gap-1.5 text-xs">
                  <span>{isLastStep ? t('tour.finish') : t('tour.next')}</span>
                  {!isLastStep &&
                    (isRtl ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />)}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
