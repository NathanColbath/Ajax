import { Component, OnDestroy, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameSystem, SystemsApi } from '../../api';
import { apiErrorMessage } from '../../core/api';
import { AjaxConfirmationService, AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
import { AjaxButton, AjaxInput, AjaxSelect, AjaxSelectOption, AjaxSpinner, AjaxTextarea } from '../../shared/ui';

@Component({
  selector: 'ajax-systems-page',
  standalone: true,
  imports: [
    FormsModule,
    AjaxButton,
    AjaxInput,
    AjaxTextarea,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSpinner,
    AjaxStatusChip,
  ],
  templateUrl: './systems.page.html',
  styleUrl: './systems.page.scss',
})
export class SystemsPage implements OnDestroy {
  private readonly api = inject(SystemsApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly confirmation = inject(AjaxConfirmationService);

  readonly loading = signal(true);
  readonly systems = signal<GameSystem[]>([]);
  readonly selectedId = signal<string | undefined>(undefined);
  readonly newExtension = signal('');
  readonly showAdd = signal(false);
  readonly editing = signal(false);
  readonly logoUrl = signal<string | null>(null);

  draftName = '';
  draftShort = '';
  draftManufacturer = 'Custom';

  editName = '';
  editShort = '';
  editManufacturer = '';
  editDescription = '';
  editReleasePeriod = '';
  editGeneration = '';
  editRegion = '';
  editPreferredPath = '';
  editEmulatorInfo = '';
  editStatus: GameSystem['status'] = 'active';
  editLibretroId = '';
  editIcon = '';
  editAccent = '';

  constructor() {
    this.reload();
  }

  ngOnDestroy(): void {
    this.revokeLogo();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (systems) => {
        this.systems.set(systems);
        if (!this.selectedId() && systems[0]) {
          this.selectedId.set(systems[0].id);
        }
        this.loading.set(false);
        const selected = this.selected();
        if (selected) {
          this.syncEdit(selected);
          this.loadLogo(selected);
        }
      },
      error: () => this.loading.set(false),
    });
  }

  selected(): GameSystem | undefined {
    return this.systems().find((s) => s.id === this.selectedId());
  }

  select(id: string): void {
    this.selectedId.set(id);
    this.editing.set(false);
    const system = this.selected();
    if (system) {
      this.syncEdit(system);
      this.loadLogo(system);
    }
  }

  addExtension(): void {
    const system = this.selected();
    const ext = this.newExtension().trim();
    if (!system || !ext) {
      return;
    }
    this.api.addExtension(system.id, ext).subscribe((updated) => {
      this.systems.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      this.newExtension.set('');
      this.feedback.success(`Added ${ext}`);
    });
  }

  openAdd(): void {
    this.showAdd.set(true);
  }

  createSystem(): void {
    const name = this.draftName.trim();
    const shortName = this.draftShort.trim() || name;
    if (!name) {
      return;
    }
    this.api
      .add({
        name,
        shortName,
        manufacturer: this.draftManufacturer.trim() || 'Custom',
        extensions: [],
        icon: 'devices',
        accent: '#2a6f7a',
        description: '',
        releasePeriod: '',
        generation: '',
        region: '',
        preferredStoragePath: '',
        metadataProviderIds: {},
        emulatorInfo: '',
        status: 'active',
      })
      .subscribe((created) => {
        this.systems.update((list) => [...list, created]);
        this.selectedId.set(created.id);
        this.showAdd.set(false);
        this.draftName = '';
        this.draftShort = '';
        this.syncEdit(created);
        this.feedback.success(`${created.name} registered`);
      });
  }

  startEdit(): void {
    const system = this.selected();
    if (!system) {
      return;
    }
    this.syncEdit(system);
    this.editing.set(true);
  }

  cancelEdit(): void {
    const system = this.selected();
    if (system) {
      this.syncEdit(system);
    }
    this.editing.set(false);
  }

  saveEdit(): void {
    const system = this.selected();
    if (!system) {
      return;
    }
    const providerIds = { ...system.metadataProviderIds };
    if (this.editLibretroId.trim()) {
      providerIds['libretro'] = this.editLibretroId.trim();
    } else {
      delete providerIds['libretro'];
    }

    this.api
      .update(system.id, {
        name: this.editName.trim(),
        shortName: this.editShort.trim(),
        manufacturer: this.editManufacturer.trim(),
        description: this.editDescription,
        releasePeriod: this.editReleasePeriod.trim(),
        generation: this.editGeneration.trim(),
        region: this.editRegion.trim(),
        preferredStoragePath: this.editPreferredPath.trim(),
        emulatorInfo: this.editEmulatorInfo,
        status: this.editStatus,
        icon: this.editIcon.trim() || system.icon,
        accent: this.editAccent.trim() || system.accent,
        metadataProviderIds: providerIds,
      })
      .subscribe({
        next: (updated) => {
          this.systems.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
          this.syncEdit(updated);
          this.editing.set(false);
          this.feedback.success('System updated');
        },
        error: () => this.feedback.error('Failed to update system'),
      });
  }

  onLogoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    const system = this.selected();
    if (!file || !system) {
      return;
    }
    this.api.uploadLogo(system.id, file).subscribe({
      next: (updated) => {
        this.systems.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.loadLogo(updated);
        this.feedback.success('Logo uploaded');
      },
      error: () => this.feedback.error('Logo upload failed'),
    });
  }

  async deleteSystem(): Promise<void> {
    const system = this.selected();
    if (!system) {
      return;
    }
    const ok = await this.confirmation.confirm({
      title: 'Delete system?',
      message: `Permanently delete “${system.name}”. Systems with games cannot be deleted.`,
      confirmLabel: 'Delete',
      severity: 'danger',
    });
    if (!ok) {
      return;
    }
    this.api.delete(system.id).subscribe({
      next: () => {
        this.systems.update((list) => list.filter((s) => s.id !== system.id));
        const next = this.systems()[0];
        this.selectedId.set(next?.id);
        if (next) {
          this.syncEdit(next);
          this.loadLogo(next);
        } else {
          this.revokeLogo();
          this.logoUrl.set(null);
        }
        this.editing.set(false);
        this.feedback.success(`Deleted ${system.name}`);
      },
      error: (err) => this.feedback.error(apiErrorMessage(err, 'Failed to delete system')),
    });
  }

  private syncEdit(system: GameSystem): void {
    this.editName = system.name;
    this.editShort = system.shortName;
    this.editManufacturer = system.manufacturer;
    this.editDescription = system.description;
    this.editReleasePeriod = system.releasePeriod;
    this.editGeneration = system.generation;
    this.editRegion = system.region;
    this.editPreferredPath = system.preferredStoragePath;
    this.editEmulatorInfo = system.emulatorInfo;
    this.editStatus = system.status;
    this.editLibretroId = system.metadataProviderIds['libretro'] ?? '';
    this.editIcon = system.icon;
    this.editAccent = system.accent;
  }

  private loadLogo(system: GameSystem): void {
    this.revokeLogo();
    if (!system.hasLogo) {
      this.logoUrl.set(null);
      return;
    }
    this.api.getLogoObjectUrl(system.id).subscribe({
      next: (url) => this.logoUrl.set(url),
      error: () => this.logoUrl.set(null),
    });
  }

  private revokeLogo(): void {
    const url = this.logoUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }
}

