import { Component } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatProgressBarModule],
  template: `<p class="p-6 text-muted">Profile loading…</p>`,
})
export class ProfileComponent {}
