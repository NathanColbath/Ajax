import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AjaxButton, AjaxInput } from '../../shared/ui';

export interface CreateListDialogData {
  initialName?: string;
}

@Component({
  selector: 'ajax-create-list-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, AjaxInput, AjaxButton],
  template: `
    <h2 mat-dialog-title>New list</h2>
    <mat-dialog-content>
      <ajax-input
        label="List name"
        placeholder="Weekend backlog"
        [(ngModel)]="name"
        name="listName"
        (keyup.enter)="submit()"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <ajax-button variant="basic" (clicked)="ref.close()">Cancel</ajax-button>
      <ajax-button variant="flat" color="primary" icon="playlist_add" (clicked)="submit()">
        Create
      </ajax-button>
    </mat-dialog-actions>
  `,
  styles: `
    mat-dialog-content {
      display: grid;
      gap: 0.75rem;
      min-width: min(100%, 360px);
      padding-top: 0.5rem;
    }
  `,
})
export class CreateListDialog {
  readonly data = inject<CreateListDialogData>(MAT_DIALOG_DATA, { optional: true });
  readonly ref = inject(MatDialogRef<CreateListDialog, string>);

  name = this.data?.initialName ?? '';

  submit(): void {
    const trimmed = this.name.trim();
    if (!trimmed) {
      return;
    }
    this.ref.close(trimmed);
  }
}
