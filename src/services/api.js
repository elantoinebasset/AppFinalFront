const API_ROOT = '/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      'Content-Type': 'application/json',
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
}
