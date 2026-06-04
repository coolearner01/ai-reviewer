import { apiFetch } from './client';
import type { AuthUser } from '@/types';

export const authApi = {
  register: (payload: { email: string; password: string; name: string }) =>
    apiFetch<{ token: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  me: () => apiFetch<{ user: AuthUser }>('/auth/me'),
};
