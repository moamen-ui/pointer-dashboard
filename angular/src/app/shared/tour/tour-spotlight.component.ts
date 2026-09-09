import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { PreferencesService } from '../../core/prefs/preferences.service';
import { TourService } from '../../core/tour/tour.service';

type TargetRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

@Component({
  selector: 'app-tour-spotlight',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule, TranslocoModule],
  template: `
    <!-- Welcome Prompt Dialog -->
    @if (tour.promptOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div class="w-full max-w-md rounded-2xl border border-app-border bg-panel p-6 shadow-2xl">
          <div class="flex items-center gap-2">
            <mat-icon class="text-brand">explore</mat-icon>
            <h3 class="m-0 text-lg font-bold text-ink">
              {{ 'tour.welcomePromptTitle' | transloco }}
            </h3>
          </div>
          <p class="mt-2.5 text-sm leading-relaxed text-muted">
            {{ 'tour.welcomePromptDesc' | transloco }}
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button mat-button type="button" (click)="tour.dismissPrompt()">
              {{ 'tour.skipTour' | transloco }}
            </button>
            <button mat-flat-button color="primary" type="button" (click)="tour.startTour()">
              <mat-icon class="me-1">explore</mat-icon>
              {{ 'tour.startTour' | transloco }}
            </button>
          </div>
        </div>
      </div>
    }

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
            class="pointer-events-none absolute rounded-lg border-2 border-brand transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
            [style.top.px]="r.top - pad"
            [style.left.px]="r.left - pad"
            [style.width.px]="r.width + pad * 2"
            [style.height.px]="r.height + pad * 2"
          ></div>
        }

        <!-- Floating Popover Card -->
        <div
          class="absolute z-50 w-[360px] max-w-[calc(100vw-40px)] rounded-xl border border-app-border bg-panel p-4 shadow-2xl transition-all duration-200"
          [style.top]="cardStyle().top"
          [style.left]="cardStyle().left"
        >
          <div class="flex items-center justify-between border-b border-app-border/60 pb-2">
            <span class="text-[0.75rem] font-semibold uppercase tracking-wider text-brand">
              {{
                'tour.stepCount'
                  | transloco: { current: tour.currentStepIndex() + 1, total: tour.totalSteps() }
              }}
            </span>
            <button
              mat-icon-button
              type="button"
              class="!h-7 !w-7"
              (click)="tour.endTour()"
              [attr.aria-label]="'tour.skipTour' | transloco"
            >
              <mat-icon class="!text-base">close</mat-icon>
            </button>
          </div>

          <div class="mt-3">
            <h4 class="m-0 text-sm font-semibold text-ink">
              {{ step.titleKey | transloco }}
            </h4>
            <p class="mt-1.5 text-xs leading-relaxed text-muted">
              {{ step.descriptionKey | transloco }}
            </p>
          </div>

          <div class="mt-4 flex items-center justify-between pt-2">
            <button
              mat-button
              type="button"
              class="!text-xs text-muted"
              (click)="tour.endTour()"
            >
              {{ 'tour.skipTour' | transloco }}
            </button>

            <div class="flex items-center gap-2">
              @if (tour.currentStepIndex() > 0) {
                <button
                  mat-stroked-button
                  type="button"
                  class="border-app-border !text-xs"
                  (click)="tour.prevStep()"
                >
                  <mat-icon class="!text-sm me-0.5">{{
                    isRtl() ? 'arrow_forward' : 'arrow_back'
                  }}</mat-icon>
                  {{ 'tour.back' | transloco }}
                </button>
              }

              <button
                mat-flat-button
                color="primary"
                type="button"
                class="!text-xs"
                (click)="tour.nextStep()"
              >
                <span>{{
                  (isLastStep() ? 'tour.finish' : 'tour.next') | transloco
                }}</span>
                @if (!isLastStep()) {
                  <mat-icon class="!text-sm ms-0.5">{{
                    isRtl() ? 'arrow_back' : 'arrow_forward'
                  }}</mat-icon>
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
