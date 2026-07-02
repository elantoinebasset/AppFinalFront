const API_ROOT = '/api'
const TOKEN_STORAGE_KEY = 'scheduler_auth_token'
const ADMIN_USERNAMES = (import.meta.env.VITE_ADMIN_USERNAMES ?? '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

function normalizeRole(role) {
  if (typeof role !== 'string') {
    return null
  }

  const upperRole = role.toUpperCase()
  if (upperRole === 'ADMIN' || upperRole === 'USER') {
    return upperRole
  }

  return null
}

function inferRoleFromUsername(username) {
  if (typeof username !== 'string') {
    return null
  }

  return ADMIN_USERNAMES.includes(username.toLowerCase()) ? 'ADMIN' : null
}

function normalizeUser(user) {
  if (!user || typeof user !== 'object') {
    return user
  }

  return {
    ...user,
    role: normalizeRole(user.role) ?? inferRoleFromUsername(user.username) ?? 'USER',
  }
}

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

function setStoredToken(token) {
  if (!token) {
    localStorage.removeItem(TOKEN_STORAGE_KEY)
    return
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

async function request(path, options = {}) {
  const token = getStoredToken()
  const authHeader = token ? { Authorization: `Bearer ${token}` } : {}

  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...authHeader,
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const message = typeof payload === 'object' && payload?.message
      ? payload.message
      : typeof payload === 'string' && payload.trim()
        ? payload
        : 'Une erreur est survenue lors de l’appel API.'
    throw new Error(message)
  }

  return payload
}

export const schedulerApi = {
  register(payload) {
    return request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => {
      setStoredToken(response.token)
      return {
        ...response,
        user: normalizeUser(response.user),
      }
    })
  },
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => {
      setStoredToken(response.token)
      return {
        ...response,
        user: normalizeUser(response.user),
      }
    })
  },
  googleLogin(credential) {
    return request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }).then((response) => {
      setStoredToken(response.token)
      return {
        ...response,
        user: normalizeUser(response.user),
      }
    })
  },
  getCurrentUser() {
    return request('/auth/me').then((user) => normalizeUser(user))
  },
  logout() {
    setStoredToken(null)
  },
  hasToken() {
    return Boolean(getStoredToken())
  },
  getHealth() {
    return request('/health')
  },
  getUsers() {
    return request('/users').then((users) => users.map((user) => normalizeUser(user)))
  },
  createUser(user) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    }).then((createdUser) => normalizeUser(createdUser))
  },
  getSchedulesByUser(userId) {
    return request(`/users/${userId}/schedules`)
  },
  createSchedule(userId, schedule) {
    return request(`/users/${userId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(schedule),
    })
  },
  createItem(scheduleId, item) {
    return request(`/schedules/${scheduleId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    })
  },
  deleteItem(scheduleId, itemId) {
    return request(`/schedules/${scheduleId}/items/${itemId}`, {
      method: 'DELETE',
    })
  },

  modifyItem(scheduleId, itemId, item) {
    return request(`/schedules/${scheduleId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    })
  },

  deleteUser(userId) {
    return request(`/users/${userId}`, {
      method: 'DELETE',
    })
  },

  deleteSchedule(userId, scheduleId) {
    return request(`/users/${userId}/schedules/${scheduleId}`, {
      method: 'DELETE',
    })
  },

  modifySchedule(userId, scheduleId, schedule) {
    return request(`/users/${userId}/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(schedule),
    })
  },
}
