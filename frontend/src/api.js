import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + '/api'
  : '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})

// Attach token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 â redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  changePassword: (data) => api.post('/auth/change-password', data),
}

export const filesApi = {
  list: () => api.get('/files/'),
  upload: (formData) => api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  download: (id) => api.get(`/files/${id}/download`),
  delete: (id) => api.delete(`/files/${id}`),
}

export const analyticsApi = {
  preview: (fileId) => api.get(`/analytics/preview/${fileId}`),
  summary: (fileId) => api.post(`/analytics/summary/${fileId}`),
  kpis: (fileId) => api.post(`/analytics/kpi/${fileId}`),
}

export const billingApi = {
  plans: () => api.get('/billing/plans'),
  createCheckout: (planId) => api.post('/billing/create-checkout', { plan_id: planId }),
  portal: () => api.get('/billing/portal'),
  cancel: () => api.post('/billing/cancel'),
}

export const usersApi = {
  team: () => api.get('/users/team'),
  invite: (data) => api.post('/users/invite', data),
  auditLog: () => api.get('/users/audit-log'),
}

export const aiApi = {
  prompt: (fileId, prompt) => api.post('/ai/prompt', { file_id: fileId, prompt }),
}

export const sheetsApi = {
  connect: (url, displayName) => api.post('/sheets/connect', { url, display_name: displayName }),
  sync: (fileId) => api.post(`/sheets/${fileId}/sync`),
}

export const dashboardsApi = {
  list: () => api.get('/dashboards/'),
  create: (data) => api.post('/dashboards/', data),
  update: (id, data) => api.put(`/dashboards/${id}`, data),
  delete: (id) => api.delete(`/dashboards/${id}`),
  share: (id) => api.post(`/dashboards/${id}/share`),
}

// Public share â no auth needed; uses plain axios so no 401 redirect
export const shareApi = {
  get: (token) => axios.get(`${API_BASE}/share/${token}`),
}

export default api

export const connectorsApi = {
  list: () => apiFetch('/api/connectors'),
  connectShopify: (data) => apiFetch('/api/connectors/shopify/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  sync: (id) => apiFetch('/api/connectors/shopify/sync/' + id, { method: 'POST' }),
  remove: (id) => apiFetch('/api/connectors/' + id, { method: 'DELETE' }),
};

export const pipelinesApi = {
  list: () => apiFetch('/api/pipelines'),
  create: (data) => apiFetch('/api/pipelines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  update: (id, data) => apiFetch('/api/pipelines/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  remove: (id) => apiFetch('/api/pipelines/' + id, { method: 'DELETE' }),
  preview: (id, data) => apiFetch('/api/pipelines/' + id + '/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
  run: (id, data) => apiFetch('/api/pipelines/' + id + '/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }),
};
