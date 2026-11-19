import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  standalone: true,
  imports: [FormsModule],
  template: `
    <main class="login-layout">
      <section class="brand-panel">
        <a class="brand" href="/login"><span class="brand-mark">D</span><strong>DevicePulse</strong></a>
        <div class="pitch"><span class="eyebrow">IT ASSET LIFECYCLE</span><h1>Your entire device fleet.<br><em>One clear view.</em></h1><p>Track, manage, and protect every asset across its lifecycle.</p></div>
        <div class="panel-foot">CONTROL · VISIBILITY · ACCOUNTABILITY</div>
      </section>
      <section class="form-panel">
        <form (ngSubmit)="submit()">
          <span class="eyebrow">WELCOME BACK</span><h2>Sign in to DevicePulse</h2><p class="intro">Enter your work credentials to access your workspace.</p>
          <label for="email">Work email</label><input id="email" name="email" type="email" [(ngModel)]="email" autocomplete="username" required>
          <label for="password">Password</label><input id="password" name="password" type="password" [(ngModel)]="password" autocomplete="current-password" required>
          @if (error) { <p class="error" role="alert">{{error}}</p> }
          <button type="submit" [disabled]="loading">{{loading ? 'Signing in…' : 'Sign in'}}</button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .login-layout{display:grid;grid-template-columns:minmax(320px,1fr) minmax(400px,1fr);min-height:100vh;background:#fff}
    .brand-panel{padding:40px 8%;background:radial-gradient(ellipse at 75% 30%,#234a70 0,#10243e 58%);color:white;display:flex;flex-direction:column}
    .brand{display:flex;align-items:center;gap:11px;color:#fff;text-decoration:none;font-size:20px}.brand-mark{background:#4f9cf3;width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:19px;font-weight:800}
    .pitch{margin:auto 0;max-width:500px}.eyebrow{font-size:11px;letter-spacing:1.6px;color:#548eca;font-weight:700}.brand-panel .eyebrow{color:#82b9f4}
    h1{font-size:clamp(34px,4vw,54px);line-height:1.14;margin:18px 0}h1 em{font-style:normal;color:#76b6fa}.pitch p{color:#b7c7d8;line-height:1.7;max-width:400px}.panel-foot{color:#8296ad;font-size:10px;letter-spacing:1.4px}
    .form-panel{display:grid;place-items:center;padding:35px}.form-panel form{width:min(100%,390px)}h2{font-size:26px;margin:12px 0 7px;color:#172b44}.intro{color:#7d8da3;font-size:14px;margin:0 0 30px}
    label{display:block;color:#344b64;font-size:13px;font-weight:600;margin:18px 0 7px}input{width:100%;height:44px;border:1px solid #d9e1eb;border-radius:7px;padding:0 12px;font:inherit;outline:none}input:focus{border-color:#468bd2;box-shadow:0 0 0 3px #468bd21c}
    button{width:100%;margin-top:24px;border:0;border-radius:7px;background:#2468a8;color:#fff;padding:13px;font:inherit;font-weight:700;cursor:pointer}button:hover{background:#18578f}button:disabled{opacity:.65;cursor:wait}.error{color:#b42318;font-size:13px}
    .demo{display:grid;gap:5px;margin-top:25px;padding:14px;background:#f4f7fb;border-radius:8px;color:#63768d;font-size:12px}.demo b{color:#344b64}
    @media(max-width:800px){.login-layout{grid-template-columns:1fr}.brand-panel{min-height:270px;padding:24px 7%}.pitch{margin:40px 0}.pitch h1{font-size:34px}.panel-foot{display:none}.form-panel{padding:35px 24px}}
  `]
})
export class LoginPageComponent {
  email = '';
  password = '';
  loading = false;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  submit(): void {
    this.loading = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: () => void this.router.navigate(['/']),
      error: (error: { error?: { error?: string } }) => {
        this.error = error.error?.error ?? 'Unable to sign in. Check that the API is running.';
        this.loading = false;
      },
      complete: () => { this.loading = false; }
    });
  }
}
