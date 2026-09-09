import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';

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

export type TourContextValue = {
  isOpen: boolean;
  promptOpen: boolean;
  currentStepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  startTour: () => void;
  endTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  dismissPrompt: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within TourProvider');
  return ctx;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [promptOpen, setPromptOpen] = useState(false);

  // When a signed-in user hasn't seen the tour, show the welcome prompt
  useEffect(() => {
    if (!userId) return;
    if (!isTourSeen(userId)) {
      setPromptOpen(true);
    }
  }, [userId]);

  const startTour = useCallback(() => {
    markTourSeen(userId);
    setPromptOpen(false);
    setCurrentStepIndex(0);
    setIsOpen(true);
  }, [userId]);

  const endTour = useCallback(() => {
    markTourSeen(userId);
    setIsOpen(false);
  }, [userId]);

  const dismissPrompt = useCallback(() => {
    markTourSeen(userId);
    setPromptOpen(false);
  }, [userId]);

  const currentStep = isOpen ? TOUR_STEPS[currentStepIndex] ?? null : null;

  // Auto-navigate to required route if the active tour step demands it
  useEffect(() => {
    if (!isOpen || !currentStep?.route) return;
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
  }, [isOpen, currentStep, location.pathname, navigate]);

  const nextStep = useCallback(() => {
    setCurrentStepIndex((prev) => {
      if (prev >= TOUR_STEPS.length - 1) {
        endTour();
        return prev;
      }
      return prev + 1;
    });
  }, [endTour]);

  const prevStep = useCallback(() => {
    setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : 0));
  }, []);

  const value = useMemo<TourContextValue>(
    () => ({
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
    }),
    [
      isOpen,
      promptOpen,
      currentStepIndex,
      currentStep,
      startTour,
      endTour,
      nextStep,
      prevStep,
      dismissPrompt,
    ],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
}
