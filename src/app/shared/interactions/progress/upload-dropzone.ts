import { booleanAttribute, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'ajax-upload-dropzone',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div
      class="dropzone"
      [class.dropzone--active]="dragActive()"
      [class.dropzone--invalid]="dragInvalid()"
      [class.dropzone--disabled]="disabled()"
      role="button"
      tabindex="0"
      [attr.aria-disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      (click)="openPicker()"
      (keydown.enter)="openPicker()"
      (keydown.space)="$event.preventDefault(); openPicker()"
      (dragover)="onDragOver($event)"
      (dragleave)="onDragLeave($event)"
      (drop)="onDrop($event)"
    >
      <mat-icon>cloud_upload</mat-icon>
      <p class="dropzone__title">{{ title() }}</p>
      <p class="dropzone__hint">{{ hint() }}</p>
      @if (error()) {
        <p class="dropzone__error" role="alert">{{ error() }}</p>
      }
      <input
        #fileInput
        type="file"
        hidden
        [attr.accept]="accept() || null"
        [multiple]="multiple()"
        [disabled]="disabled()"
        (change)="onFileInput($event)"
      />
    </div>
  `,
  styles: `
    .dropzone {
      display: grid;
      place-items: center;
      gap: 0.35rem;
      padding: 1.5rem 1rem;
      border: 2px dashed var(--mat-sys-outline-variant);
      border-radius: 10px;
      background: var(--mat-sys-surface-container-lowest);
      text-align: center;
      cursor: pointer;
      transition:
        border-color var(--ajax-motion-fast) var(--ajax-easing-standard),
        background-color var(--ajax-motion-fast) var(--ajax-easing-standard);
    }

    .dropzone:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .dropzone--active {
      border-color: var(--mat-sys-primary);
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, white);
    }

    .dropzone--invalid {
      border-color: var(--ajax-color-danger);
      background: color-mix(in srgb, var(--ajax-color-danger) 8%, white);
    }

    .dropzone--disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .dropzone__title {
      margin: 0.25rem 0 0;
      font-weight: 600;
    }

    .dropzone__hint,
    .dropzone__error {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .dropzone__error {
      color: var(--ajax-color-danger);
    }
  `,
})
export class AjaxUploadDropzone {
  private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  readonly accept = input('');
  readonly multiple = input(false, { transform: booleanAttribute });
  readonly maxFileSize = input<number | undefined>(undefined);
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly title = input('Drop files here or click to browse');
  readonly hint = input('Any supported file type');
  readonly ariaLabel = input('File upload drop zone');

  readonly filesSelected = output<File[]>();

  readonly dragActive = signal(false);
  readonly dragInvalid = signal(false);
  readonly error = signal<string | undefined>(undefined);

  openPicker(): void {
    if (this.disabled()) {
      return;
    }
    this.fileInput().nativeElement.click();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (this.disabled()) {
      return;
    }
    this.dragActive.set(true);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.dragInvalid.set(!this.validateFiles(Array.from(files), false));
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    this.dragInvalid.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    this.dragInvalid.set(false);
    if (this.disabled()) {
      return;
    }
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.emitValidFiles(files);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.emitValidFiles(files);
    input.value = '';
  }

  private emitValidFiles(files: File[]): void {
    if (!this.validateFiles(files, true)) {
      return;
    }
    const selected = this.multiple() ? files : files.slice(0, 1);
    this.error.set(undefined);
    this.filesSelected.emit(selected);
  }

  private validateFiles(files: File[], setError: boolean): boolean {
    if (!files.length) {
      return false;
    }

    if (!this.multiple() && files.length > 1) {
      if (setError) {
        this.error.set('Only one file is allowed.');
      }
      return false;
    }

    const max = this.maxFileSize();
    if (max != null && files.some((file) => file.size > max)) {
      if (setError) {
        this.error.set(`Each file must be under ${Math.round(max / 1024)} KB.`);
      }
      return false;
    }

    const accept = this.accept()
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    if (accept.length) {
      const ok = files.every((file) =>
        accept.some((rule) => {
          if (rule.startsWith('.')) {
            return file.name.toLowerCase().endsWith(rule.toLowerCase());
          }
          if (rule.endsWith('/*')) {
            return file.type.startsWith(rule.replace('/*', '/'));
          }
          return file.type === rule;
        }),
      );
      if (!ok) {
        if (setError) {
          this.error.set('One or more files are not an accepted type.');
        }
        return false;
      }
    }

    return true;
  }
}
