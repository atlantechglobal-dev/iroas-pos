export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
}

/** Platform Super Admin (IROAS operator). Distinct from restaurant owner/admin. */
export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function isSuperAdmin(user) {
  return isAdmin(user)
}

export function isOwner(user) {
  return user?.role === ROLES.OWNER
}
