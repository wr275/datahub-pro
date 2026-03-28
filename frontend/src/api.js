import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL + '/api' : '/api'

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
  upload: (formData) => api.post('/files/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
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

export const connectorsApi = {
  list: () => api.get('/connectors/'),
  connectShopify: (data) => api.post('/connectors/shopify/connect', data),
  sync: (id) => api.post('/connectors/shopify/sync/' + id),
  remove: (id) => api.delete('/connectors/' + id),
}

export const pipelinesApi = {
  list: () => api.get('/pipelines/'),
  create: (data) => api.post('/pipelines/', data),
  update: (id, data) => api.put('/pipelines/' + id, data),
  remove: (id) => api.delete('/pipelines/' + id),
  preview: (id, data) => api.post('/pipelines/' + id + '/preview', data),
  run: (id, data) => api.post('/pipelines/' + id + '/run', data),
}


export const budgetApi = {
  listBudgets: () => api.get('/budget/budgets'),
  getSummary: (name, period) => api.get('/budget/' + encodeURIComponent(name) + '/summary', { params: period ? { period } : {} }),
  upload: (data) => api.post('/budget/upload', data),
  deleteBudget: (name) => api.delete('/budget/' + encodeURIComponent(name)),
}

export const dashboardsApi = {
  list: () => api.get('/dashboards/'),
  create: (data) => api.post('/dashboards/', data),
  update: (id, data) => api.put('/dashboards/' + id, data),
  delete: (id) => api.delete('/dashboards/' + id),
  share: (id) => api.post('/dashboards/' + id + '/share'),
}

export const sheetsApi = {
  connect: (url, name) => api.post('/sheets/connect', { url, name }),
  sync: (fileId) => api.post('/sheets/' + fileId + '/sync'),
}

export const calculatedFieldsApi = {
  list: () => api.get('/calculated-fields/'),
  save: (data) => api.post('/calculated-fields/', data),
  preview: (data) => api.post('/calculated-fields/preview', data),
  export: (data) => api.post('/calculated-fields/export', data, { responseType: 'blob' }),
  delete: (id) => api.delete('/calculated-fields/' + id),
}

export default api
