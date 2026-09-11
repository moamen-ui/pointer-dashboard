import {
  Injectable,
  Component,
  signal,
  computed,
  effect,
  input,
  inject,
  ApplicationRef,
  ComponentRef,
  EmbeddedViewRef,
  EnvironmentInjector,
  createComponent,
  Type,
} from '@angular/core';
import { AppIconComponent } from './app-icon.component';

export type ToastSeverity = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
}

@Component({
  selector: 'app-toast-item',
  standalone: true,
  imports: [AppIconComponent],
  template: `
    <div
      class="rounded-md border border-border bg-background shadow-menu px-3 py-2 text-[14px] flex items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <app-icon
        [name]="iconName()"
        [size]="16"
        class="flex-shrink-0"
        [class]="iconClass()"
      ></app-icon>
      <span>{{ message() }}</span>
    </div>
  `,
})
export class AppToastItemComponent {
  readonly message = input('');
  readonly severity = input<ToastSeverity>('info');

  iconName(): string {
    switch (this.severity()) {
      case 'success':
        return 'check-circle';
      case 'danger':
        return 'alert-circle';
      case 'warning':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  }

  iconClass(): string {
    switch (this.severity()) {
      case 'success':
        return 'text-state-completed';
      case 'danger':
        return 'text-state-danger';
      case 'warning':
        return 'text-state-ready';
      default:
        return 'text-state-open';
    }
  }
}

@Injectable({
  providedIn: 'root',
})
export class AppToastService {
  private toasts = signal<Toast[]>([]);
  toasts$ = computed(() => this.toasts());

  private nextId = 0;
  private containerRef: ComponentRef<AppToastContainerComponent> | null = null;

  constructor(
    private appRef: ApplicationRef,
    private injector: EnvironmentInjector,
  ) {}

  private initContainer(): void {
    if (!this.containerRef) {
      this.containerRef = createComponent(AppToastContainerComponent, {
        environmentInjector: this.injector,
      });
      this.appRef.attachView(this.containerRef.hostView);
      document.body.appendChild((this.containerRef.hostView as EmbeddedViewRef<any>).rootNodes[0]);
    }
  }

  show(message: string, severity: ToastSeverity = 'info', duration = 3000): void {
    // Lazily mount the container on first use: creating it in the constructor makes the
    // container's own AppToastService injection a circular dependency (NG0200).
    this.initContainer();
    const id = `toast-${this.nextId++}`;
    const toast: Toast = { id, message, severity };

    this.toasts.update(toasts => [...toasts, toast]);

    setTimeout(() => {
      this.toasts.update(toasts => toasts.filter(t => t.id !== id));
    }, duration);
  }

  getToasts(): Toast[] {
    return this.toasts();
  }
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [AppToastItemComponent],
  template: `
    <div
      class="fixed bottom-4 end-4 z-50 flex flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      @for (toast of toasts(); track $index) {
        <app-toast-item [message]="toast.message" [severity]="toast.severity"></app-toast-item>
      }
    </div>
  `,
})
export class AppToastContainerComponent {
  private readonly toastService = inject(AppToastService);

  readonly toasts = computed(() => this.toastService.getToasts());
}
