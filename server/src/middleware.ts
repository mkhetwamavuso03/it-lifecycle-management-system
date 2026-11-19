import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z, ZodSchema } from 'zod';
import { getJwtSecret } from './config.js';

export type AuthUser = { userId: string; role: 'IT_ADMIN'|'ASSET_MANAGER'|'EMPLOYEE' };
declare global { namespace Express { interface Request { auth?: AuthUser } } }

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.safeParse({ body: req.body, query: req.query, params: req.params });
    if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    req.body = parsed.data.body ?? req.body;
    next();
  };
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    req.auth = jwt.verify(token, getJwtSecret()) as AuthUser;
    next();
  } catch { res.status(401).json({ error: 'Invalid or expired session' }); }
}

export function authorize(...roles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction) =>
    req.auth && roles.includes(req.auth.role) ? next() : res.status(403).json({ error: 'Insufficient permissions' });
}

export function sanitizeNoSqlAndXss(req: Request, _res: Response, next: NextFunction) {
  const scrub = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replace(/<[^>]*>/g, '').replace(/\$\s*(where|gt|gte|lt|lte|ne|in|nin|regex)/gi, '');
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !k.startsWith('$')).map(([k,v])=>[k,scrub(v)]));
    return value;
  };
  req.body = scrub(req.body);
  req.params = scrub(req.params) as Request['params'];
  next();
}
