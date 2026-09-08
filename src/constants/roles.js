export const ROLES = {
  OWNER: 'owner',
  ADMIN: 'admin',
}

export function isAdmin(user) {
  return user?.role === ROLES.ADMIN
}

export function isOwner(user) {
  return user?.role === ROLES.OWNER
}
