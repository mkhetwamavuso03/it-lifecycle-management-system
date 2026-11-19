import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, Routes } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { LayoutComponent } from './app/layout.component';
import { authInterceptor } from './app/core/auth.interceptor';
import { authGuard } from './app/core/auth.guard';
import { adminGuard } from './app/core/admin.guard';
import { LoginPageComponent } from './app/features/auth/login-page.component';
import { DashboardPageComponent } from './app/features/dashboard/dashboard-page.component';
import { DevicesPageComponent } from './app/features/devices/devices-page.component';
import { DeviceFormPageComponent } from './app/features/devices/device-form-page.component';
import { AssignmentsPageComponent } from './app/features/assignments/assignments-page.component';
import { MaintenancePageComponent } from './app/features/maintenance/maintenance-page.component';
import { AuditLogsPageComponent } from './app/features/audit-logs/audit-logs-page.component';
import { StaffPageComponent } from './app/features/staff/staff-page.component';

const routes: Routes = [
  { path: 'login', component: LoginPageComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardPageComponent },
      { path: 'devices', component: DevicesPageComponent },
      { path: 'devices/new', component: DeviceFormPageComponent },
      { path: 'assignments', component: AssignmentsPageComponent },
      { path: 'maintenance', component: MaintenancePageComponent },
      { path: 'audit-logs', component: AuditLogsPageComponent },
      { path: 'staff', component: StaffPageComponent, canActivate: [adminGuard] }
    ]
  },
  { path: '**', redirectTo: '' }
];

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAnimations()
  ]
});
