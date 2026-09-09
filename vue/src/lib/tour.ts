import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';

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

const TOUR_SEEN_KEY = (userId: string) => `pointer_tour_seen:${userId}`;

export function isTourSeen(userId: string | null): boolean {
  if (!userId) return true;
  try {
    return localStorage.getItem(TOUR_SEEN_KEY(userId)) === '1';
  } catch {
    return true;
  }
}

export function markTourSeen(userId: string | null): void {
  if (!userId) return;
  try {
    localStorage.setItem(TOUR_SEEN_KEY(userId), '1');
  } catch {
    // ignore
  }
}

const isOpen = ref(false);
const currentStepIndex = ref(0);
const promptOpen = ref(false);

export function useTour() {
  const router = useRouter();
  const route = useRoute();
  const { user } = useAuth();
  const userId = computed(() => user.value?.id ?? null);

  // Initialize prompt if not seen
  watch(
    userId,
    (id) => {
      if (id && !isTourSeen(id)) {
        promptOpen.value = true;
      }
    },
    { immediate: true },
  );

  const currentStep = computed(() =>
    isOpen.value ? TOUR_STEPS[currentStepIndex.value] ?? null : null,
  );

  // Navigate when step requires route
  watch([isOpen, currentStep], ([open, step]) => {
    if (open && step?.route && route?.path !== step.route && router) {
      router.push(step.route);
    }
  });

  function startTour(): void {
    markTourSeen(userId.value);
    promptOpen.value = false;
    currentStepIndex.value = 0;
    isOpen.value = true;
  }

  function endTour(): void {
    markTourSeen(userId.value);
    isOpen.value = false;
  }

  function dismissPrompt(): void {
    markTourSeen(userId.value);
    promptOpen.value = false;
  }

  function nextStep(): void {
    if (currentStepIndex.value >= TOUR_STEPS.length - 1) {
      endTour();
    } else {
      currentStepIndex.value += 1;
    }
  }

  function prevStep(): void {
    if (currentStepIndex.value > 0) {
      currentStepIndex.value -= 1;
    }
  }

  return {
    isOpen,
    promptOpen,
    currentStepIndex,
    currentStep,
    totalSteps: TOUR_STEPS.length,
    startTour,
    endTour,
    nextStep,
    prevStep,
    dismissPrompt,
  };
}
