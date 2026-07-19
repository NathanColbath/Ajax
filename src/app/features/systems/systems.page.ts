import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GameSystem, SystemsApi } from '../../api';
import { AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
import { AjaxButton, AjaxInput, AjaxSpinner } from '../../shared/ui';

@Component({
  selector: 'ajax-systems-page',
  standalone: true,
  imports: [FormsModule, AjaxButton, AjaxInput, AjaxSpinner, AjaxStatusChip],
  templateUrl: './systems.page.html',
  styleUrl: './systems.page.scss',
})
export class SystemsPage {
  private readonly api = inject(SystemsApi);
  private readonly feedback = inject(AjaxFeedbackService);

  readonly loading = signal(true);
  readonly systems = signal<GameSystem[]>([]);
  readonly selectedId = signal<string | undefined>(undefined);
  readonly newExtension = signal('');
  readonly showAdd = signal(false);
  draftName = '';
  draftShort = '';
  draftManufacturer = 'Custom';

  constructor() {
    this.reload();
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
      },
      error: () => this.loading.set(false),
    });
  }

  selected(): GameSystem | undefined {
    return this.systems().find((s) => s.id === this.selectedId());
  }

  select(id: string): void {
    this.selectedId.set(id);
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
      })
      .subscribe((created) => {
        this.systems.update((list) => [...list, created]);
        this.selectedId.set(created.id);
        this.showAdd.set(false);
        this.draftName = '';
        this.draftShort = '';
        this.feedback.success(`${created.name} registered`);
      });
  }
}
