export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  SPECIALIST: 'specialist',
}

export function isSuperAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function isPlatformStaff(user) {
  return user?.role === ROLES.ADMIN || user?.role === ROLES.SPECIALIST
}

// legacy name for isPlatformStaff
export function isAdmin(user) {
  return isPlatformStaff(user)
}

export function isOwner(user) {
  return user?.role === ROLES.OWNER
}
