import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.me().pipe(
    map(user => user.role === 'IT_ADMIN' ? true : router.createUrlTree(['/'])),
    catchError(() => of(router.createUrlTree(['/login'])))
  );
};
