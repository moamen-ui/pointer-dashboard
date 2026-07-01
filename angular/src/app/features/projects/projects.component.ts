import { Component, inject, signal, TemplateRef, viewChild, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  ProjectsService,
  ExportImportService,
  getApiAdminProjectsResource,
  ImportResultDto,
} from '@moamen-ui/pointer-angular';
import { extractMessage } from '../../core/api/extract-message';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { AuthService } from '../../core/auth/auth.service';
import type { ProjectResponse, ExportFileDto } from '@moamen-ui/pointer-angular';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatTableModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatIconModule,
    MatDialogModule,
    TranslocoModule,
  ],
  template: `
    <div class="p-6">
      <div class="mb-4 flex items-center justify-between gap-3">
        <h2 class="m-0 text-[1.5em] font-bold">{{ 'projects.title' | transloco }}</h2>
        <button mat-flat-button color="primary" (click)="openAdd()">
          <mat-icon>add</mat-icon> {{ 'projects.addProject' | transloco }}
        </button>
      </div>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      <table mat-table [dataSource]="projects()" class="w-full mat-elevation-z2">
        <ng-container matColumnDef="key">
          <th mat-header-cell *matHeaderCellDef>{{ 'projects.key' | transloco }}</th>
          <td mat-cell *matCellDef="let project"><code>{{ project.key }}</code></td>
        </ng-container>

        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>{{ 'projects.name' | transloco }}</th>
          <td mat-cell *matCellDef="let project">{{ project.name }}</td>
        </ng-container>

        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>{{ 'projects.status' | transloco }}</th>
          <td mat-cell *matCellDef="let project">
            <span class="chip" [class.chip-active]="project.isActive" [class.chip-disabled]="!project.isActive">
              {{ project.isActive ? ('common.active' | transloco) : ('common.disabled' | transloco) }}
            </span>
          </td>
        </ng-container>

        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>{{ 'projects.actions' | transloco }}</th>
          <td mat-cell *matCellDef="let project">
            <div class="flex items-center gap-2 flex-wrap">
              <button mat-stroked-button [color]="project.isActive ? 'warn' : 'primary'"
                (click)="toggleActive(project)" [disabled]="loading()">
                <mat-icon>{{ project.isActive ? 'block' : 'check_circle' }}</mat-icon>
                {{ project.isActive ? ('common.disable' | transloco) : ('common.enable' | transloco) }}
              </button>
              <button mat-stroked-button (click)="exportProject(project)" [disabled]="loading()">
                <mat-icon>download</mat-icon> {{ 'exportImport.export' | transloco }}
              </button>
              @if (auth.isSuperAdmin()) {
                <button mat-stroked-button (click)="openImport(project)" [disabled]="loading()">
                  <mat-icon>upload</mat-icon> {{ 'exportImport.import' | transloco }}
                </button>
              }
            </div>
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
      </table>
    </div>

    <!-- Add project dialog -->
    <ng-template #addDialog>
      <h2 mat-dialog-title>{{ 'projects.addProject' | transloco }}</h2>
      <mat-dialog-content>
        <form [formGroup]="addForm" (ngSubmit)="addProject()" class="flex min-w-80 flex-col gap-3 pt-2">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'projects.key' | transloco }}</mat-label>
            <input matInput formControlName="key" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'projects.name' | transloco }}</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>

          <!-- Predefined actions section -->
          <div class="mt-2">
            <div class="mb-1 text-[0.95rem] font-semibold">{{ 'predefined.section' | transloco }}</div>
            <p class="mb-2 text-[0.8rem] text-muted">{{ 'predefined.projectHelp' | transloco }}</p>
            <div formArrayName="predefinedActions" class="flex flex-col gap-3">
              @for (action of predefinedActionsArray.controls; track $index) {
                <div [formGroupName]="$index" class="rounded border border-app-border p-3 flex flex-col gap-2">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'predefined.text' | transloco }}</mat-label>
                    <input matInput formControlName="text" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>{{ 'predefined.prompt' | transloco }}</mat-label>
                    <textarea matInput formControlName="prompt" rows="2"></textarea>
                  </mat-form-field>
                  <button mat-stroked-button color="warn" type="button" (click)="removeAction($index)">
                    <mat-icon>remove</mat-icon>
                  </button>
                </div>
              }
            </div>
            @if (predefinedActionsArray.length === 0) {
              <p class="text-[0.8rem] text-muted">{{ 'predefined.empty' | transloco }}</p>
            }
            <button mat-stroked-button type="button" class="mt-2 border-app-border" (click)="addAction()">
              <mat-icon>add</mat-icon> {{ 'predefined.add' | transloco }}
            </button>
          </div>
        </form>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="addProject()" [disabled]="addForm.invalid || loading()">
          <mat-icon>add</mat-icon> {{ 'projects.addProject' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>

    <!-- Import dialog -->
    <ng-template #importDialog>
      <h2 mat-dialog-title>{{ 'exportImport.importTitle' | transloco }}</h2>
      <mat-dialog-content>
        <p class="mb-4 mt-1 text-[0.9rem] text-muted">{{ 'exportImport.importHint' | transloco }}</p>
        <div class="flex flex-col gap-3 min-w-80">
          <input #fileInput type="file" accept=".json" class="block w-full text-[0.9rem]"
            (change)="onFileSelected($event)" />
        </div>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close [disabled]="importBusy()">{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button color="primary" (click)="submitImport()" [disabled]="!importFile() || importBusy()">
          <mat-icon>upload</mat-icon> {{ 'exportImport.import' | transloco }}
        </button>
      </mat-dialog-actions>
    </ng-template>
  `,
})
export class ProjectsComponent {
  private projectsService = inject(ProjectsService);
  private exportImportService = inject(ExportImportService);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private transloco = inject(TranslocoService);
  private dialog = inject(MatDialog);
  auth = inject(AuthService);

  readonly addDialog = viewChild.required<TemplateRef<unknown>>('addDialog');
  readonly importDialog = viewChild.required<TemplateRef<unknown>>('importDialog');
  private dialogRef?: MatDialogRef<unknown>;

  projectsResource = getApiAdminProjectsResource();
  projects = computed(() => this.projectsResource.value() ?? []);
  busy = signal(false);
  loading = computed(() => this.projectsResource.isLoading() || this.busy());

  importBusy = signal(false);
  importFile = signal<File | null>(null);
  private importProjectKey = signal<string>('');

  displayedColumns = ['key', 'name', 'status', 'actions'];

  addForm = this.fb.nonNullable.group({
    key: ['', Validators.required],
    name: ['', Validators.required],
    predefinedActions: this.fb.array([]),
  });

  get predefinedActionsArray(): FormArray {
    return this.addForm.get('predefinedActions') as FormArray;
  }

  addAction(): void {
    this.predefinedActionsArray.push(
      this.fb.nonNullable.group({
        text: ['', Validators.required],
        prompt: ['', Validators.required],
      })
    );
  }

  removeAction(index: number): void {
    this.predefinedActionsArray.removeAt(index);
  }

  openAdd() {
    this.addForm.reset({ key: '', name: '' });
    while (this.predefinedActionsArray.length) {
      this.predefinedActionsArray.removeAt(0);
    }
    this.dialogRef = this.dialog.open(this.addDialog(), { width: '540px' });
  }

  addProject() {
    if (this.addForm.invalid) return;
    this.busy.set(true);
    const val = this.addForm.getRawValue();
    const predefinedActions = (val.predefinedActions as { text: string; prompt: string }[]).map((a, i) => ({
      text: a.text,
      prompt: a.prompt,
      sortOrder: i,
      isActive: true,
    }));
    this.projectsService.postApiAdminProjects({ key: val.key, name: val.name, predefinedActions } as any).subscribe({
      next: () => {
        this.busy.set(false);
        this.dialogRef?.close();
        this.addForm.reset();
        this.projectsResource.reload();
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  toggleActive(project: ProjectResponse) {
    if (!project.isActive) {
      this.patchActive(project, true);
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          message: this.transloco.translate('common.confirmDisable', { name: project.key }),
          confirmLabel: this.transloco.translate('common.disable'),
          confirmColor: 'warn',
        },
      })
      .afterClosed()
      .subscribe((ok) => {
        if (ok) this.patchActive(project, false);
      });
  }

  private patchActive(project: ProjectResponse, isActive: boolean) {
    this.busy.set(true);
    this.projectsService.patchApiAdminProjectsId(project.id!, { isActive }).subscribe({
      next: () => { this.busy.set(false); this.projectsResource.reload(); },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  // --- Export ---
  exportProject(project: ProjectResponse): void {
    this.busy.set(true);
    this.http.get<ExportFileDto>(`/api/projects/${project.key}/export`).subscribe({
      next: (data) => {
        this.busy.set(false);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `pointer-comments-${project.key}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        this.snack.open(this.transloco.translate('exportImport.exported'), 'OK', { duration: 3000 });
      },
      error: (e: unknown) => { this.busy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
    });
  }

  // --- Import ---
  openImport(project: ProjectResponse): void {
    this.importProjectKey.set(project.key ?? '');
    this.importFile.set(null);
    this.dialogRef = this.dialog.open(this.importDialog(), { width: '480px' });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
  }

  submitImport(): void {
    const file = this.importFile();
    if (!file) return;
    this.importBusy.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        const key = this.importProjectKey();
        this.http.post<ImportResultDto>(`/api/projects/${key}/import`, parsed).subscribe({
          next: (result) => {
            this.importBusy.set(false);
            this.dialogRef?.close();
            const countMsg = this.transloco.translate('exportImport.importCounts', {
              comments: result.importedComments ?? 0,
              replies: result.importedReplies ?? 0,
            });
            this.snack.open(
              `${this.transloco.translate('exportImport.imported')} ${countMsg}`,
              'OK',
              { duration: 6000 }
            );
            if ((result.warnings ?? []).length > 0) {
              result.warnings!.forEach((w) =>
                this.snack.open(w, 'OK', { duration: 5000 })
              );
            }
            this.projectsResource.reload();
          },
          error: (e: unknown) => { this.importBusy.set(false); this.snack.open(extractMessage(e), 'OK', { duration: 4000 }); },
        });
      } catch {
        this.importBusy.set(false);
        this.snack.open('Invalid JSON file', 'OK', { duration: 4000 });
      }
    };
    reader.readAsText(file);
  }
}
