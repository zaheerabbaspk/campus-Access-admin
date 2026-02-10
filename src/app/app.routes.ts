import { Routes } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';

const authGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};

const loginGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
    canActivate: [loginGuard]
  },
  {
    path: '',
    loadComponent: () => import('./core/layouts/main-layout/main-layout.component').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage)
      },
      {
        path: 'departments',
        loadComponent: () => import('./pages/departments/departments.page').then(m => m.DepartmentsPage)
      },
      {
        path: 'sections',
        loadComponent: () => import('./pages/sections/sections.page').then(m => m.SectionsPage)
      },
      {
        path: 'students',
        loadComponent: () => import('./pages/students/students.page').then(m => m.StudentsPage)
      },
      {
        path: 'logs',
        loadComponent: () => import('./pages/logs/logs.page').then(m => m.LogsPage)
      },
      {
        path: 'audit-logs',
        loadComponent: () => import('./pages/audit-logs/audit-logs.page').then(m => m.AuditLogsPage)
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },
  {
    path: 'terminal',
    loadComponent: () => import('./pages/terminal/terminal.page').then(m => m.TerminalPage),
    canActivate: [authGuard]
  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
