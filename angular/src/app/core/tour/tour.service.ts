import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';

export type TourStep = {
  id: string;
  targetSelector: string;
  route?: string;
  titleKey: string;
  descriptionKey: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'nav-projects',
    targetSelector: '[data-tour="nav-projects"]',
    titleKey: 'tour.stepProjectsTitle',
    descriptionKey: 'tour.stepProjectsDesc',
    placement: 'right',
  },
  {
    id: 'add-project-btn',
    targetSelector: '[data-tour="add-project-btn"]',
    route: '/projects',
    titleKey: 'tour.stepAddProjectTitle',
    descriptionKey: 'tour.stepAddProjectDesc',
    placement: 'bottom',
  },
  {
    id: 'project-modal-sections',
    targetSelector: '[data-tour="project-modal-sections"]',
    route: '/projects',
    titleKey: 'tour.stepProjectSettingsTitle',
    descriptionKey: 'tour.stepProjectSettingsDesc',
    placement: 'bottom',
  },
  {
    id: 'nav-environments',
    targetSelector: '[data-tour="nav-environments"]',
    titleKey: 'tour.stepEnvironmentsTitle',
    descriptionKey: 'tour.stepEnvironmentsDesc',
    placement: 'right',
  },
  {
    id: 'nav-install-guide',
    targetSelector: '[data-tour="nav-install-guide"]',
    titleKey: 'tour.stepInstallGuideTitle',
    descriptionKey: 'tour.stepInstallGuideDesc',
    placement: 'top',
  },
];

const TOUR_SEEN_KEY = (userId: number | string) => `pointer_tour_seen:${userId}`;

@Injectable({ providedIn: 'root' })
export class TourService {
  private router = inject(Router);
  private auth = inject(AuthService);

  readonly isOpen = signal(false);
  readonly promptOpen = signal(false);
  readonly currentStepIndex = signal(0);

  readonly currentStep = computed(() =>
    this.isOpen() ? TOUR_STEPS[this.currentStepIndex()] ?? null : null,
  );
  readonly totalSteps = computed(() => TOUR_STEPS.length);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      if (user?.id != null && !this.isTourSeen(user.id)) {
        this.promptOpen.set(true);
      }
    });

    effect(() => {
      const open = this.isOpen();
      const step = this.currentStep();
      if (open && step?.route && !this.router.url.startsWith(step.route)) {
        this.router.navigateByUrl(step.route);
      }
    });
  }

  isTourSeen(userId: number | string | null): boolean {
    if (userId == null) return true;
    try {
      return localStorage.getItem(TOUR_SEEN_KEY(userId)) === '1';
    } catch {
      return true;
    }
  }

  markTourSeen(userId: number | string | null): void {
    if (userId == null) return;
    try {
      localStorage.setItem(TOUR_SEEN_KEY(userId), '1');
    } catch {
      // ignore
    }
  }

  startTour(): void {
    this.markTourSeen(this.auth.user()?.id ?? null);
    this.promptOpen.set(false);
    this.currentStepIndex.set(0);
    this.isOpen.set(true);
  }

  endTour(): void {
    this.markTourSeen(this.auth.user()?.id ?? null);
    this.isOpen.set(false);
  }

  dismissPrompt(): void {
    this.markTourSeen(this.auth.user()?.id ?? null);
    this.promptOpen.set(false);
  }

  nextStep(): void {
    if (this.currentStepIndex() >= TOUR_STEPS.length - 1) {
      this.endTour();
    } else {
      this.currentStepIndex.update((i) => i + 1);
    }
  }

  prevStep(): void {
    if (this.currentStepIndex() > 0) {
      this.currentStepIndex.update((i) => i - 1);
    }
  }
}
