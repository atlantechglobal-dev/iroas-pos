// URY staff READ, scoped by the mapped restaurant's Branch:
//   getdoc Branch <restaurant.branch>   -> user[] (URY User rows: user, room)
//   get_list Employee (branch = branch, or user_id in branch users)
//   get_list User (name in branch users) -> full_name, enabled
//   get_list POS Profile (restaurant)    -> applicable_for_users = POS access
// Employee records carry pay/bank/ID fields; only the fields below are read.

const SYSTEM_USERS = new Set(['Administrator', 'Guest'])
const EMPLOYEE_FIELDS = ['name', 'employee_name', 'designation', 'department', 'status', 'branch', 'user_id', 'date_of_joining']

/** `tenant` comes from resolveUryTenant(); its branch is the verified mapped branch. */
export async function listUryStaff(tenant) {
  const { client, uryRestaurant, branch, integrationUser } = tenant
  const { getDoc, getList } = client
  const hidden = new Set([...SYSTEM_USERS, integrationUser])

  const branchDoc = (await getDoc('Branch', branch)).docs[0]
  const roomByUser = new Map()
  for (const row of branchDoc.user || []) {
    if (row.parent !== branchDoc.name || !row.user || hidden.has(row.user)) continue
    if (!roomByUser.has(row.user)) roomByUser.set(row.user, row.room || '')
  }
  const branchUsers = [...roomByUser.keys()]

  const [byBranch, byUser, users, profiles] = await Promise.all([
    getList('Employee', { fields: EMPLOYEE_FIELDS, filters: { branch } }),
    branchUsers.length
      ? getList('Employee', { fields: EMPLOYEE_FIELDS, filters: { user_id: ['in', branchUsers] } })
      : [],
    branchUsers.length
      ? getList('User', { fields: ['name', 'full_name', 'enabled'], filters: { name: ['in', branchUsers] } })
      : [],
    getList('POS Profile', { fields: ['name', 'restaurant', 'disabled'], filters: { restaurant: uryRestaurant } }),
  ])

  const posUsers = new Set()
  for (const profile of profiles) {
    if (profile.restaurant !== uryRestaurant || profile.disabled === 1) continue
    const doc = (await getDoc('POS Profile', profile.name)).docs[0]
    for (const row of doc.applicable_for_users || []) if (row.user) posUsers.add(row.user)
  }

  const userById = new Map(users.map((u) => [u.name, u]))
  const employees = new Map()
  for (const emp of [...byBranch, ...byUser]) {
    const inBranch = emp.branch === branch || (emp.user_id && roomByUser.has(emp.user_id))
    if (inBranch) employees.set(emp.name, emp)
  }

  const staff = []
  const seenUsers = new Set()
  for (const emp of employees.values()) {
    const user = emp.user_id ? userById.get(emp.user_id) : null
    if (emp.user_id) seenUsers.add(emp.user_id)
    staff.push({
      id: emp.name,
      name: emp.employee_name || user?.full_name || emp.name,
      email: emp.user_id || '',
      designation: emp.designation || '',
      department: emp.department || '',
      room: emp.user_id ? roomByUser.get(emp.user_id) || '' : '',
      active: emp.status === 'Active' && (!user || user.enabled === 1),
      employeeStatus: emp.status || '',
      joinedOn: emp.date_of_joining || null,
      posAccess: Boolean(emp.user_id && posUsers.has(emp.user_id)),
    })
  }
  for (const userId of branchUsers) {
    if (seenUsers.has(userId)) continue
    const user = userById.get(userId)
    staff.push({
      id: userId,
      name: user?.full_name || userId,
      email: userId,
      designation: '',
      department: '',
      room: roomByUser.get(userId) || '',
      active: user ? user.enabled === 1 : false,
      employeeStatus: '',
      joinedOn: null,
      posAccess: posUsers.has(userId),
    })
  }
  staff.sort((a, b) => a.name.localeCompare(b.name))
  return { branch, staff }
}
