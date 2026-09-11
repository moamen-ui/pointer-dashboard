import { Component, computed, effect, inject, OnDestroy, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { PreferencesService } from '../../core/prefs/preferences.service';
import { TourService } from '../../core/tour/tour.service';
import { AppDialogService } from '../ui/app-dialog.service';
import { AppButtonDirective } from '../ui/app-button.directive';
import { AppIconComponent } from '../ui/app-icon.component';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

@Component({
  selector: 'app-tour-spotlight',
  standalone: true,
  imports: [TranslocoModule, AppButtonDirective, AppIconComponent],
  host: {
    // Escape ends an in-progress tour (the welcome dialog closes on Escape via CDK Dialog).
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    <!-- Welcome Prompt Dialog (via AppDialogService) -->
    <ng-template #welcomePrompt>
      <div class="px-5 pt-5 pb-3 border-b border-border">
        <h2 class="m-0 text-[16px] font-semibold text-foreground flex items-center gap-2">
          <app-icon name="compass" class="w-5 h-5 text-brand" />
          {{ 'tour.welcomePromptTitle' | transloco }}
        </h2>
      </div>
      <div class="px-5 py-2 space-y-4">
        <p class="text-[14px] leading-relaxed text-muted-foreground">
          {{ 'tour.welcomePromptDesc' | transloco }}
        </p>
      </div>
      <div class="px-5 pb-5 pt-3 flex justify-end gap-2">
        <button appButton variant="secondary" size="default" type="button" (click)="dismissWelcome()">
          {{ 'tour.skipTour' | transloco }}
        </button>
        <button appButton variant="primary" size="default" type="button" (click)="startTourAndCloseWelcome()">
          {{ 'tour.startTour' | transloco }}
        </button>
      </div>
    </ng-template>

    <!-- Spotlight Dimming Overlay & Card -->
    @if (tour.isOpen() && tour.currentStep(); as step) {
      <div class="fixed inset-0 z-50 overflow-hidden pointer-events-auto">
        <!-- Dimming Mask SVG -->
        <svg class="absolute inset-0 h-full w-full pointer-events-none">
          <defs>
            <mask id="angular-tour-spotlight-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              @if (rect(); as r) {
                <rect
                  [attr.x]="r.left - pad"
                  [attr.y]="r.top - pad"
                  [attr.width]="r.width + pad * 2"
                  [attr.height]="r.height + pad * 2"
                  rx="8"
                  fill="black"
                />
              }
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.72)"
            mask="url(#angular-tour-spotlight-mask)"
          />
        </svg>

        <!-- Highlight Border Ring -->
        @if (rect(); as r) {
          <div
            class="pointer-events-none absolute rounded-lg border-2 border-brand transition-all duration-300"
            style="box-shadow: 0 0 15px rgba(var(--brand-rgb, 59, 130, 246), 0.5)"
            [style.top.px]="r.top - pad"
            [style.left.px]="r.left - pad"
            [style.width.px]="r.width + pad * 2"
            [style.height.px]="r.height + pad * 2"
          ></div>
        }

        <!-- Floating Popover Card -->
        <div
          class="absolute z-50 w-[360px] max-w-[calc(100vw-40px)] rounded-md border border-border bg-background p-3 shadow-menu transition-all duration-200"
          [style.top]="cardStyle().top"
          [style.left]="cardStyle().left"
        >
          <!-- Header: close button -->
          <div class="flex items-center justify-end pb-2 border-b border-border/60">
            <button
              appButton
              variant="ghost"
              size="icon"
              type="button"
              class="h-7 w-7"
              (click)="tour.endTour()"
              [attr.aria-label]="'tour.skipTour' | transloco"
            >
              <app-icon name="x" class="w-4 h-4" />
            </button>
          </div>

          <!-- Content -->
          <div class="mt-3">
            <h4 class="m-0 text-sm font-semibold text-foreground">
              {{ step.titleKey | transloco }}
            </h4>
            <p class="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
              {{ step.descriptionKey | transloco }}
            </p>
          </div>

          <!-- Actions -->
          <div class="mt-4 flex items-center justify-between pt-2">
            <span class="text-[12px] font-mono text-muted-foreground">
              {{ 'tour.stepOf' | transloco: { current: tour.currentStepIndex() + 1, total: tour.totalSteps() } }}
            </span>

            <div class="flex items-center gap-2">
              @if (tour.currentStepIndex() > 0) {
                <button
                  appButton
                  variant="secondary"
                  size="sm"
                  type="button"
                  (click)="tour.prevStep()"
                >
                  @if (isRtl()) {
                    <app-icon name="arrow-right" class="w-3.5 h-3.5" />
                  } @else {
                    <app-icon name="arrow-left" class="w-3.5 h-3.5" />
                  }
                  {{ 'tour.back' | transloco }}
                </button>
              }

              <button
                appButton
                variant="primary"
                size="sm"
                type="button"
                (click)="tour.nextStep()"
              >
                <span>{{
                  (isLastStep() ? 'tour.finish' : 'tour.next') | transloco
                }}</span>
                @if (!isLastStep()) {
                  @if (isRtl()) {
                    <app-icon name="arrow-left" class="w-3.5 h-3.5" />
                  } @else {
                    <app-icon name="arrow-right" class="w-3.5 h-3.5" />
                  }
                }
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class TourSpotlightComponent implements OnInit, OnDestroy {
  tour = inject(TourService);
  prefs = inject(PreferencesService);
  private appDialog = inject(AppDialogService);

  readonly welcomePrompt = viewChild.required<TemplateRef<unknown>>('welcomePrompt');
  private welcomeDialogRef: any;

  readonly pad = 6;
  readonly rect = signal<TargetRect | null>(null);
  readonly isRtl = computed(() => this.prefs.language() === 'ar');
  readonly isLastStep = computed(
    () => this.tour.currentStepIndex() === this.tour.totalSteps() - 1,
  );

  readonly cardStyle = computed(() => {
    const r = this.rect();
    if (!r) {
      return { top: '50%', left: '50%' };
    }

    const padSize = 12;
    const cardWidth = 360;
    const cardHeight = 220;

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let top = r.top + r.height + padSize;
    let left = r.left;

    if (top + cardHeight > viewportH - 20) {
      top = Math.max(20, r.top - cardHeight - padSize);
    }

    if (left + cardWidth > viewportW - 20) {
      left = Math.max(20, viewportW - cardWidth - 20);
    }
    if (left < 20) left = 20;

    return {
      top: `${Math.round(top)}px`,
      left: `${Math.round(left)}px`,
    };
  });

  private onResizeOrScroll = () => this.updateRect();

  constructor() {
    effect(() => {
      const promptOpen = this.tour.promptOpen();
      if (promptOpen) {
        this.openWelcomeDialog();
      }
    });

    effect(() => {
      const open = this.tour.isOpen();
      const step = this.tour.currentStep();
      if (open && step) {
        this.updateRect();
      } else {
        this.rect.set(null);
      }
    });
  }

  ngOnInit(): void {
    window.addEventListener('resize', this.onResizeOrScroll);
    window.addEventListener('scroll', this.onResizeOrScroll, true);
  }

  ngOnDestroy(): void {
    window.removeEventListener('resize', this.onResizeOrScroll);
    window.removeEventListener('scroll', this.onResizeOrScroll, true);
    if (this.welcomeDialogRef) {
      this.welcomeDialogRef.close();
    }
  }

  private openWelcomeDialog(): void {
    if (this.welcomeDialogRef) {
      return; // Dialog already open
    }
    this.welcomeDialogRef = this.appDialog.openRef(this.welcomePrompt(), { disableClose: false });
  }

  dismissWelcome(): void {
    this.tour.dismissPrompt();
    this.welcomeDialogRef?.close();
    this.welcomeDialogRef = null;
  }

  onEscape(): void {
    if (this.tour.isOpen()) this.tour.endTour();
  }

  startTourAndCloseWelcome(): void {
    this.tour.startTour();
    this.welcomeDialogRef?.close();
    this.welcomeDialogRef = null;
  }

  private updateRect(): void {
    const step = this.tour.currentStep();
    if (!this.tour.isOpen() || !step) {
      this.rect.set(null);
      return;
    }

    const el = document.querySelector(step.targetSelector);
    if (!el) {
      setTimeout(() => {
        const retryStep = this.tour.currentStep();
        if (!retryStep) return;
        const retryEl = document.querySelector(retryStep.targetSelector);
        if (retryEl) {
          retryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          const b = retryEl.getBoundingClientRect();
          this.rect.set({ top: b.top, left: b.left, width: b.width, height: b.height });
        }
      }, 300);
      return;
    }

    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const b = el.getBoundingClientRect();
    this.rect.set({ top: b.top, left: b.left, width: b.width, height: b.height });
  }
}
