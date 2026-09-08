import type { Scout } from './types';

const ADMIN_USERNAMES = ['wanderson'];

export function isAdminScout(scout: Scout | null | undefined): boolean {
  const username = scout?.username?.trim().toLowerCase();
  return !!username && ADMIN_USERNAMES.includes(username);
}
