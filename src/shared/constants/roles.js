export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  SPECIALIST: 'specialist',
}

/** Platform Super Admin (IROAS operator). Distinct from restaurant owner/admin. */
export function isSuperAdmin(user) {
  return user?.role === ROLES.ADMIN
}

/** Anyone who works in the IROAS platform console: Super Admin or Onboarding Specialist. */
export function isPlatformStaff(user) {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.SPECIALIST
}

/** @deprecated Legacy name: "is a platform console user". Prefer isPlatformStaff / isSuperAdmin. */
export function isAdmin(user) {
  return isPlatformStaff(user)
}

export function isOwner(user) {
  return user?.role === ROLES.OWNER
}
