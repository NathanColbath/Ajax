import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageEvent } from '@angular/material/paginator';
import { LibraryUser, UsersApi, UserRole } from '../../api';
import { initialsFromName } from '../../core/auth/auth-roles';
import { SessionService } from '../../core/auth/session.service';
import { AjaxEmptyState, AjaxFeedbackService, AjaxStatusChip } from '../../shared/interactions';
import {
  AjaxButton,
  AjaxInput,
  AjaxPagination,
  AjaxSelect,
  AjaxSelectOption,
  AjaxSlideToggle,
  AjaxSpinner,
  AjaxTable,
  AjaxTableColumn,
} from '../../shared/ui';

@Component({
  selector: 'ajax-users-page',
  standalone: true,
  imports: [
    FormsModule,
    AjaxButton,
    AjaxInput,
    AjaxSelect,
    AjaxSelectOption,
    AjaxSlideToggle,
    AjaxSpinner,
    AjaxEmptyState,
    AjaxStatusChip,
    AjaxTable,
    AjaxPagination,
  ],
  templateUrl: './users.page.html',
  styleUrl: './users.page.scss',
})
export class UsersPage {
  private readonly api = inject(UsersApi);
  private readonly feedback = inject(AjaxFeedbackService);
  private readonly session = inject(SessionService);

  readonly loading = signal(true);
  readonly users = signal<LibraryUser[]>([]);
  readonly showInvite = signal(false);
  readonly view = signal<'cards' | 'table'>('cards');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(5);
  inviteName = '';
  inviteEmail = '';
  inviteRole: UserRole = 'standard';

  readonly columns: AjaxTableColumn<LibraryUser>[] = [
    { key: 'name', header: 'Name' },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', cell: (row) => row.role.replace('_', ' ') },
    { key: 'enabled', header: 'Status', cell: (row) => (row.enabled ? 'Active' : 'Disabled') },
  ];

  readonly pagedUsers = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.users().slice(start, this.pageSize() + start);
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list().subscribe({
      next: (users) => {
        this.users.set(this.mergeAuth0User(users));
        this.pageIndex.set(0);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Ensure the signed-in Auth0 user appears with their claim role. */
  private mergeAuth0User(directory: LibraryUser[]): LibraryUser[] {
    const session = this.session.session();
    if (!session) {
      return directory;
    }

    const authUser: LibraryUser = {
      id: session.userId,
      name: session.displayName,
      email: session.email ?? session.displayName,
      role: session.role,
      enabled: true,
      initials: initialsFromName(session.displayName),
    };

    const withoutDup = directory.filter(
      (u) => u.id !== authUser.id && u.email.toLowerCase() !== authUser.email.toLowerCase(),
    );
    return [authUser, ...withoutDup];
  }

  toggle(user: LibraryUser, enabled: boolean): void {
    if (user.enabled === enabled) {
      return;
    }
    if (user.id === this.session.userId()) {
      this.feedback.warning('Your Auth0 account cannot be disabled here');
      return;
    }
    this.api.toggleEnabled(user.id).subscribe((updated) => {
      this.users.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
      this.feedback.info(updated.enabled ? `${updated.name} enabled` : `${updated.name} disabled`);
    });
  }

  invite(): void {
    if (!this.inviteName.trim() || !this.inviteEmail.trim()) {
      this.feedback.warning('Name and email are required');
      return;
    }
    this.api.invite(this.inviteName.trim(), this.inviteEmail.trim(), this.inviteRole).subscribe((user) => {
      this.users.update((list) => this.mergeAuth0User([user, ...list.filter((u) => u.id !== user.id)]));
      this.showInvite.set(false);
      this.inviteName = '';
      this.inviteEmail = '';
      this.inviteRole = 'standard';
      this.feedback.success(`${user.name} invited (local preview)`);
    });
  }

  onPage(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
  }

  roleTone(role: UserRole): 'info' | 'success' | 'neutral' {
    if (role === 'super_admin') {
      return 'success';
    }
    if (role === 'admin') {
      return 'info';
    }
    return 'neutral';
  }
}
