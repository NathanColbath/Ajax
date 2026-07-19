import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { AppShell } from './core/layout/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
    canActivate: [guestGuard],
    title: 'Sign in · Game Library',
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
        data: { title: 'Dashboard' },
        title: 'Dashboard · Game Library',
      },
      {
        path: 'games',
        loadComponent: () =>
          import('./features/games/games.page').then((m) => m.GamesPage),
        data: { title: 'Games' },
        title: 'Games · Game Library',
      },
      {
        path: 'games/:id',
        loadComponent: () =>
          import('./features/games/game-detail.page').then((m) => m.GameDetailPage),
        data: { title: 'Game' },
        title: 'Game · Game Library',
      },
      {
        path: 'physical',
        loadComponent: () =>
          import('./features/physical/physical.page').then((m) => m.PhysicalPage),
        data: { title: 'Physical' },
        title: 'Physical · Game Library',
      },
      {
        path: 'systems',
        loadComponent: () =>
          import('./features/systems/systems.page').then((m) => m.SystemsPage),
        canActivate: [roleGuard],
        data: { title: 'Systems', minRole: 'admin' },
        title: 'Systems · Game Library',
      },
      {
        path: 'uploads',
        loadComponent: () =>
          import('./features/uploads/uploads.page').then((m) => m.UploadsPage),
        canActivate: [roleGuard],
        data: { title: 'Uploads', minRole: 'admin' },
        title: 'Uploads · Game Library',
      },
      {
        path: 'metadata',
        loadComponent: () =>
          import('./features/metadata/metadata.page').then((m) => m.MetadataPage),
        canActivate: [roleGuard],
        data: { title: 'Metadata', minRole: 'admin' },
        title: 'Metadata · Game Library',
      },
      {
        path: 'duplicates',
        loadComponent: () =>
          import('./features/duplicates/duplicates.page').then((m) => m.DuplicatesPage),
        canActivate: [roleGuard],
        data: { title: 'Duplicates', minRole: 'admin' },
        title: 'Duplicates · Game Library',
      },
      {
        path: 'exports',
        loadComponent: () =>
          import('./features/exports/exports.page').then((m) => m.ExportsPage),
        canActivate: [roleGuard],
        data: { title: 'Exports', minRole: 'admin' },
        title: 'Exports · Game Library',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users.page').then((m) => m.UsersPage),
        canActivate: [roleGuard],
        data: { title: 'Users', minRole: 'admin' },
        title: 'Users · Game Library',
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./features/config/config.page').then((m) => m.ConfigPage),
        canActivate: [roleGuard],
        data: { title: 'Config', minRole: 'admin' },
        title: 'Config · Game Library',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
        data: { title: 'Settings' },
        title: 'Settings · Game Library',
      },
      {
        path: 'ui',
        loadComponent: () =>
          import('./features/ui-showcase/ui-showcase.page').then((m) => m.UiShowcasePage),
        canActivate: [roleGuard],
        data: { title: 'Shared UI', minRole: 'admin' },
        title: 'Shared UI · Game Library',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
