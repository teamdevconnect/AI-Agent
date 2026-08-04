import type { User } from '@/types';

export function hasRole(user: User | null | undefined, role: string): boolean {
  return user?.roles?.includes(role) ?? false;
}

export function isAdmin(user: User | null | undefined): boolean {
  return hasRole(user, 'admin');
}
