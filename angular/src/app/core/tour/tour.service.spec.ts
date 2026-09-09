import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { TourService, TOUR_STEPS } from './tour.service';

function memoryStorage(): Storage {
  let store: Record<string, string> = {};
  return {
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
  } as Storage;
}

Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), writable: true });

describe('TourService', () => {
  let tour: TourService;
  const userSignal = signal<{ id: number; email: string } | null>({ id: 42, email: 'user@example.test' });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { user: userSignal } },
      ],
    });
    tour = TestBed.inject(TourService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with all 5 tour steps', () => {
    expect(tour.totalSteps()).toBe(5);
    expect(TOUR_STEPS[0].id).toBe('nav-projects');
    expect(TOUR_STEPS[1].id).toBe('add-project-btn');
    expect(TOUR_STEPS[2].id).toBe('project-modal-sections');
    expect(TOUR_STEPS[3].id).toBe('nav-environments');
    expect(TOUR_STEPS[4].id).toBe('nav-install-guide');
  });

  it('starts tour and navigates forward and back', () => {
    expect(tour.isOpen()).toBe(false);
    tour.startTour();

    expect(tour.isOpen()).toBe(true);
    expect(tour.currentStepIndex()).toBe(0);
    expect(tour.currentStep()?.id).toBe('nav-projects');

    tour.nextStep();
    expect(tour.currentStepIndex()).toBe(1);
    expect(tour.currentStep()?.id).toBe('add-project-btn');

    tour.prevStep();
    expect(tour.currentStepIndex()).toBe(0);

    tour.endTour();
    expect(tour.isOpen()).toBe(false);
  });

  it('marks tour as seen in localStorage', () => {
    expect(tour.isTourSeen(42)).toBe(false);
    tour.markTourSeen(42);
    expect(tour.isTourSeen(42)).toBe(true);
  });

  it('dismisses welcome prompt and records seen', () => {
    tour.promptOpen.set(true);
    tour.dismissPrompt();
    expect(tour.promptOpen()).toBe(false);
    expect(tour.isTourSeen(42)).toBe(true);
  });
});
