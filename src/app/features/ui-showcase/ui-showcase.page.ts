import { Component, computed, inject, signal } from '@angular/core';
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import {
  AjaxActionButton,
  AjaxActionState,
  AjaxConfirmationService,
  AjaxCopyAction,
  AjaxEmptyState,
  AjaxFeedbackService,
  AjaxIconAction,
  AjaxInlineSaveState,
  AjaxInlineSaveStatus,
  AjaxProgressAction,
  AjaxProgressStep,
  AjaxSkeletonCard,
  AjaxSkeletonList,
  AjaxStatusChip,
  AjaxUploadDropzone,
  AjaxUploadItem,
  AjaxUploadQueue,
} from '../../shared/interactions';
import {
  AjaxBadge,
  AjaxBreadcrumb,
  AjaxBreadcrumbItem,
  AjaxButton,
  AjaxCard,
  AjaxCheckbox,
  AjaxChip,
  AjaxChipList,
  AjaxDatepicker,
  AjaxDialog,
  AjaxDivider,
  AjaxDrawer,
  AjaxAccordion,
  AjaxExpansion,
  AjaxHeaderButton,
  AjaxHeaderButtonGroup,
  AjaxIcon,
  AjaxInput,
  AjaxList,
  AjaxListItem,
  AjaxMenu,
  AjaxMenuItem,
  AjaxPagination,
  AjaxPanel,
  AjaxProgress,
  AjaxRadio,
  AjaxRadioGroup,
  AjaxSelect,
  AjaxSelectOption,
  AjaxSlideToggle,
  AjaxSpinner,
  AjaxTab,
  AjaxTable,
  AjaxTableColumn,
  AjaxTabs,
  AjaxTextarea,
  AjaxToast,
  AjaxTooltip,
  AjaxValidationService,
  ajaxControl,
} from '../../shared/ui';

interface DemoRow extends Record<string, unknown> {
  title: string;
  system: string;
  year: number;
  status: string;
}

@Component({
  selector: 'ajax-ui-showcase-page',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    AjaxBadge,
    AjaxBreadcrumb,
    AjaxButton,
    AjaxCard,
    AjaxCheckbox,
    AjaxChipList,
    AjaxDatepicker,
    AjaxDivider,
    AjaxDrawer,
    AjaxAccordion,
    AjaxExpansion,
    AjaxHeaderButton,
    AjaxHeaderButtonGroup,
    AjaxIcon,
    AjaxInput,
    AjaxList,
    AjaxMenu,
    AjaxMenuItem,
    AjaxPagination,
    AjaxPanel,
    AjaxProgress,
    AjaxRadio,
    AjaxRadioGroup,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSlideToggle,
    AjaxSpinner,
    AjaxTab,
    AjaxTable,
    AjaxTabs,
    AjaxTextarea,
    AjaxTooltip,
    AjaxActionButton,
    AjaxIconAction,
    AjaxInlineSaveStatus,
    AjaxStatusChip,
    AjaxCopyAction,
    AjaxProgressAction,
    AjaxUploadDropzone,
    AjaxUploadQueue,
    AjaxEmptyState,
    AjaxSkeletonCard,
    AjaxSkeletonList,
  ],
  templateUrl: './ui-showcase.page.html',
  styleUrl: './ui-showcase.page.scss',
})
export class UiShowcasePage {
  private readonly toast = inject(AjaxToast);
  private readonly dialog = inject(AjaxDialog);
  readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);
  private readonly validation = inject(AjaxValidationService);

  readonly breadcrumbs: AjaxBreadcrumbItem[] = [
    { label: 'Home', link: '/' },
    { label: 'Shared UI' },
  ];

  name = '';
  notes = '';
  system = 'nes';
  owned = true;
  favorite = false;
  region = 'ntsc';
  releaseDate: Date | null = null;

  readonly validationForm = new FormGroup({
    name: ajaxControl('', ['required', { minLength: 3 }], { nonNullable: true }),
    email: ajaxControl('', ['required', 'email'], { nonNullable: true }),
    notes: ajaxControl('', [{ maxLength: 200, message: 'Keep notes under 200 characters' }], {
      nonNullable: true,
    }),
  });

  readonly drawerOpen = signal(false);
  readonly progressValue = signal(65);

  readonly saveState = signal<AjaxActionState>('idle');
  readonly copyIconState = signal<AjaxActionState>('idle');
  readonly inlineSaveState = signal<AjaxInlineSaveState>('unsaved');
  readonly uploadItems = signal<AjaxUploadItem[]>([]);

  readonly importSteps = signal<AjaxProgressStep[]>([
    { id: 'validate', label: 'Validate files', state: 'complete' },
    { id: 'upload', label: 'Upload payload', state: 'active', description: 'Sending batch 2 of 4' },
    { id: 'process', label: 'Process records', state: 'pending' },
    { id: 'index', label: 'Rebuild search index', state: 'pending' },
  ]);

  readonly chips = signal<AjaxChip[]>([
    { label: 'Action', removable: true },
    { label: 'RPG', removable: true, selected: true },
    { label: 'Platformer', removable: true },
  ]);

  readonly listItems: AjaxListItem[] = [
    { id: 1, label: 'Nintendo Entertainment System', description: '8-bit home console', icon: 'sports_esports' },
    { id: 2, label: 'Sega Genesis', description: '16-bit home console', icon: 'stadia_controller' },
    { id: 3, label: 'PlayStation', description: '32-bit optical disc', icon: 'videogame_asset' },
  ];

  private readonly allRows: DemoRow[] = [
    { title: 'Super Mario Bros.', system: 'NES', year: 1985, status: 'Owned' },
    { title: 'Sonic the Hedgehog', system: 'Genesis', year: 1991, status: 'Owned' },
    { title: 'Final Fantasy VII', system: 'PlayStation', year: 1997, status: 'Wishlist' },
    { title: 'The Legend of Zelda', system: 'NES', year: 1986, status: 'Owned' },
    { title: 'Streets of Rage 2', system: 'Genesis', year: 1992, status: 'Owned' },
    { title: 'Metal Gear Solid', system: 'PlayStation', year: 1998, status: 'Wishlist' },
    { title: 'Metroid', system: 'NES', year: 1986, status: 'Owned' },
    { title: 'Phantasy Star IV', system: 'Genesis', year: 1993, status: 'Owned' },
    { title: 'Castlevania: Symphony of the Night', system: 'PlayStation', year: 1997, status: 'Owned' },
    { title: 'Kirby’s Adventure', system: 'NES', year: 1993, status: 'Owned' },
    { title: 'Gunstar Heroes', system: 'Genesis', year: 1993, status: 'Wishlist' },
    { title: 'Crash Bandicoot', system: 'PlayStation', year: 1996, status: 'Owned' },
  ];

  readonly columns: AjaxTableColumn<DemoRow>[] = [
    { key: 'title', header: 'Title' },
    { key: 'system', header: 'System' },
    { key: 'year', header: 'Year' },
    { key: 'status', header: 'Status' },
  ];

  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);

  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.allRows.slice(start, start + this.pageSize());
  });

  readonly totalRows = this.allRows.length;

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  removeChip(chip: AjaxChip): void {
    this.chips.update((items) => items.filter((item) => item.label !== chip.label));
  }

  showToast(type: 'success' | 'error' | 'info' | 'warn'): void {
    const messages = {
      success: 'Library scan completed.',
      error: 'Unable to save collection changes.',
      info: 'Metadata import is queued.',
      warn: 'Duplicate ROM detected.',
    };
    this.toast[type](messages[type]);
  }

  openConfirm(): void {
    this.dialog
      .confirm({
        title: 'Delete game entry?',
        message: 'This removes the catalog record but does not delete files from disk.',
        confirmLabel: 'Delete',
        confirmColor: 'warn',
      })
      .subscribe((confirmed) => {
        if (confirmed) {
          this.toast.success('Game entry deleted.');
        } else {
          this.toast.info('Delete cancelled.');
        }
      });
  }

  onMenuAction(action: string): void {
    this.toast.info(`Menu action: ${action}`);
  }

  onHeaderAction(action: string): void {
    this.toast.info(`Header action: ${action}`);
  }

  runSaveDemo(): void {
    this.saveState.set('loading');
    window.setTimeout(() => {
      this.saveState.set('success');
      window.setTimeout(() => this.saveState.set('idle'), 1200);
    }, 900);
  }

  runCopyIconDemo(): void {
    this.copyIconState.set('loading');
    window.setTimeout(() => {
      this.copyIconState.set('success');
      window.setTimeout(() => this.copyIconState.set('idle'), 1000);
    }, 500);
  }

  async runDangerConfirm(): Promise<void> {
    const confirmed = await this.confirmation.confirm({
      title: 'Permanently delete record?',
      message: 'This cannot be undone.',
      confirmLabel: 'Delete forever',
      severity: 'danger',
    });
    this.feedback.info(confirmed ? 'Deleted' : 'Cancelled');
  }

  showErrorWithRetry(): void {
    this.feedback.error('Unable to save', {
      actionLabel: 'Retry',
      onAction: () => this.feedback.info('Retrying…'),
    });
  }

  showUndoable(): void {
    this.feedback.undoable('Record archived', {
      onUndo: () => this.feedback.info('Restored'),
    });
  }

  onFilesSelected(files: File[]): void {
    const next = files.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      name: file.name,
      size: file.size,
      progress: 35,
      state: 'uploading' as const,
    }));
    this.uploadItems.update((items) => [...items, ...next]);
    this.feedback.info(`${files.length} file(s) queued`);
  }

  cancelUpload(id: string): void {
    this.uploadItems.update((items) =>
      items.map((item) => (item.id === id ? { ...item, state: 'cancelled', progress: 0 } : item)),
    );
  }

  retryUpload(id: string): void {
    this.uploadItems.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, state: 'uploading', progress: 10, message: undefined } : item,
      ),
    );
  }

  submitValidationForm(): void {
    this.validation.markAllTouched(this.validationForm);
    if (this.validationForm.valid) {
      this.toast.success('Validation form looks good.');
      return;
    }
    this.toast.warn('Fix the highlighted fields.');
  }
}
