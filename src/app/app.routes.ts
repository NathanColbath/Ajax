import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth/auth.guards';
import { AppShell } from './core/layout/app-shell';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.page').then((m) => m.LoginPage),
    canActivate: [guestGuard],
    title: 'Sign in · Retrojax',
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
        title: 'Dashboard · Retrojax',
      },
      {
        path: 'games',
        loadComponent: () =>
          import('./features/games/games.page').then((m) => m.GamesPage),
        data: { title: 'Games' },
        title: 'Games · Retrojax',
      },
      {
        path: 'games/:id',
        loadComponent: () =>
          import('./features/games/game-detail.page').then((m) => m.GameDetailPage),
        data: { title: 'Game' },
        title: 'Game · Retrojax',
      },
      {
        path: 'lists',
        loadComponent: () =>
          import('./features/lists/lists.page').then((m) => m.ListsPage),
        data: { title: 'My lists' },
        title: 'My lists · Retrojax',
      },
      {
        path: 'lists/:id',
        loadComponent: () =>
          import('./features/lists/list-detail.page').then((m) => m.ListDetailPage),
        data: { title: 'List' },
        title: 'List · Retrojax',
      },
      {
        path: 'physical',
        loadComponent: () =>
          import('./features/physical/physical.page').then((m) => m.PhysicalPage),
        data: { title: 'Physical' },
        title: 'Physical · Retrojax',
      },
      {
        path: 'systems',
        loadComponent: () =>
          import('./features/systems/systems.page').then((m) => m.SystemsPage),
        canActivate: [roleGuard],
        data: { title: 'Systems', minRole: 'admin' },
        title: 'Systems · Retrojax',
      },
      {
        path: 'uploads',
        loadComponent: () =>
          import('./features/uploads/uploads.page').then((m) => m.UploadsPage),
        data: { title: 'Uploads' },
        title: 'Uploads · Retrojax',
      },
      {
        path: 'metadata',
        loadComponent: () =>
          import('./features/metadata/metadata.page').then((m) => m.MetadataPage),
        canActivate: [roleGuard],
        data: { title: 'Metadata', minRole: 'admin' },
        title: 'Metadata · Retrojax',
      },
      {
        path: 'duplicates',
        loadComponent: () =>
          import('./features/duplicates/duplicates.page').then((m) => m.DuplicatesPage),
        canActivate: [roleGuard],
        data: { title: 'Duplicates', minRole: 'admin' },
        title: 'Duplicates · Retrojax',
      },
      {
        path: 'exports',
        loadComponent: () =>
          import('./features/exports/exports.page').then((m) => m.ExportsPage),
        canActivate: [roleGuard],
        data: { title: 'Exports', minRole: 'admin' },
        title: 'Exports · Retrojax',
      },
      {
        path: 'logs',
        loadComponent: () =>
          import('./features/logs/logs.page').then((m) => m.LogsPage),
        canActivate: [roleGuard],
        data: { title: 'Logs', minRole: 'admin' },
        title: 'Logs · Retrojax',
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/users.page').then((m) => m.UsersPage),
        canActivate: [roleGuard],
        data: { title: 'Users', minRole: 'admin' },
        title: 'Users · Retrojax',
      },
      {
        path: 'config',
        loadComponent: () =>
          import('./features/config/config.page').then((m) => m.ConfigPage),
        canActivate: [roleGuard],
        data: { title: 'Config', minRole: 'admin' },
        title: 'Config · Retrojax',
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.page').then((m) => m.SettingsPage),
        data: { title: 'Settings' },
        title: 'Settings · Retrojax',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
