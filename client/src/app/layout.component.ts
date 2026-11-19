import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <main class="shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/"> <span class="brand-mark">D</span><strong>DevicePulse</strong></a>
        <p class="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <a routerLink="/" [routerLinkActiveOptions]="{exact:true}" routerLinkActive="active"><span>◫</span>Overview</a>
          <a routerLink="/devices" routerLinkActive="active"><span>▣</span>Devices</a>
          <a routerLink="/assignments" routerLinkActive="active"><span>⇄</span>Assignments</a>
          <a routerLink="/maintenance" routerLinkActive="active"><span>⚙</span>Maintenance</a>
          <a routerLink="/audit-logs" routerLinkActive="active"><span>≡</span>Audit logs</a>
          <a routerLink="/staff" routerLinkActive="active"><span>♙</span>Staff</a>
        </nav>
        <div class="sidebar-user">
          <span class="avatar">{{auth.user()?.fullName?.charAt(0) || 'U'}}</span>
          <div><b>{{auth.user()?.fullName}}</b><small>{{auth.user()?.role?.replace('_', ' ')}}</small></div>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div class="breadcrumb">DevicePulse <span>/</span> IT workspace</div>
          <button class="logout-button" type="button" (click)="logout()">Sign out</button>
        </header>
        <div class="page-content"><router-outlet /></div>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;color:#172b44;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .shell{min-height:100vh;background:#f4f7fb;display:grid;grid-template-columns:238px minmax(0,1fr)}
    .sidebar{background:#10243e;color:#fff;padding:24px 16px;display:flex;flex-direction:column}
    .brand{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none;font-size:19px;padding:4px 8px 36px}
    .brand-mark{background:#4f9cf3;width:31px;height:31px;border-radius:9px;display:grid;place-items:center;font-size:18px;font-weight:800}
    .nav-label{font-size:10px;letter-spacing:1.4px;color:#8296ad;padding:0 12px}
    nav{display:grid;gap:6px}
    nav a{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:8px;color:#b5c3d3;text-decoration:none;font-size:14px}
    nav a span{width:18px;text-align:center;font-size:16px}
    nav a:hover,nav a.active{background:#1d3b61;color:#fff}
    .sidebar-user{margin-top:auto;border-top:1px solid #2a405b;padding:18px 5px 0;display:flex;align-items:center;gap:10px}
    .avatar{width:34px;height:34px;background:#d7e8fb;color:#22588c;border-radius:50%;display:grid;place-items:center;font-weight:700}
    .sidebar-user b,.sidebar-user small{display:block}.sidebar-user b{font-size:12px}.sidebar-user small{font-size:10px;color:#a8b7c8;margin-top:3px}
    .workspace{min-width:0}.topbar{height:64px;background:#fff;border-bottom:1px solid #e8edf3;display:flex;align-items:center;justify-content:space-between;padding:0 34px}
    .breadcrumb{color:#7d8da3;font-size:13px}.breadcrumb span{padding:0 8px;color:#c1cbd6}
    .logout-button{border:1px solid #dfe6ee;background:#fff;color:#40546c;padding:8px 13px;border-radius:7px;cursor:pointer}
    .logout-button:hover{background:#f4f7fb}.page-content{padding:30px 34px;max-width:1600px;margin:auto}
    @media(max-width:760px){.shell{grid-template-columns:66px minmax(0,1fr)}.sidebar{padding:18px 8px}.brand{justify-content:center;padding:0 0 30px}.brand strong,.nav-label{display:none}nav a{justify-content:center;padding:12px 0;font-size:0}nav a span{font-size:16px}.sidebar-user{justify-content:center}.sidebar-user div{display:none}.topbar{padding:0 15px}.page-content{padding:22px 14px}}
  `]
})
export class LayoutComponent {
  constructor(public auth: AuthService, private router: Router) {}

  logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => void this.router.navigate(['/login'])
    });
  }
}
