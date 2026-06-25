const API_ROOT = '/api'
const TOKEN_STORAGE_KEY = 'scheduler_auth_token'

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
      return response
    })
  },
  login(payload) {
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).then((response) => {
      setStoredToken(response.token)
      return response
    })
  },
  getCurrentUser() {
    return request('/auth/me')
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
    return request('/users')
  },
  createUser(user) {
    return request('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    })
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

  deleteUser(userId) {
    return request(`/users/${userId}`, {
      method: 'DELETE',
    })
  }
}
