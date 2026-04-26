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
  invitePreview: (token) => api.get('/auth/invite-preview', { params: { token } }),
  acceptInvite: (data) => api.post('/auth/accept-invite', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
}

export const filesApi = {
  list: () => api.get('/files/'),
  upload: (formData, onProgress) => api.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (!onProgress || !e.total) return
      onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
    },
  }),
  // Lightweight pre-upload dedup check — filename + size only, no payload sent.
  checkDuplicate: (filename, size) => api.post('/files/check-duplicate', { filename, size }),
  download: (id) => api.get(`/files/${id}/download`),
  delete: (id) => api.delete(`/files/${id}`),
  // Onboarding: seed a bundled demo CSV into the caller's org so new users
  // can jump straight to a populated dashboard without uploading anything.
  sampleTemplates: () => api.get('/files/sample-templates'),
  seedSample: (templateId) => api.post(`/files/seed-sample/${templateId}`),
}

export const analyticsApi = {
  preview: (fileId) => api.get(`/analytics/preview/${fileId}`),
  summary: (fileId) => api.post(`/analytics/summary/${fileId}`),
  kpis: (fileId) => api.post(`/analytics/kpi/${fileId}`),
  forecast: (fileId, opts) => api.post(`/analytics/forecast/${fileId}`, opts || {}),
}

export const aiApi = {
  insights: (fileId) => api.post(`/ai/insights/${fileId}`),
  prompt: (data) => api.post('/ai/prompt', data),
  greet: (data) => api.post('/ai/greet', data),
  formula: (data) => api.post('/ai/formula', data),
  chat: (data) => api.post('/ai/chat', data),
  report: (fileId) => api.post(`/ai/report/${fileId}`),
  reportExport: (data) => api.post('/ai/report/export', data, { responseType: 'blob' }),
  narrative: (fileId, opts) => api.post(`/ai/narrative/${fileId}`, opts || {}),
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
  // Bulk invite — body: { invites: [{email, full_name, role}, ...] }
  inviteBulk: (invites) => api.post('/users/invite-bulk', { invites }),
  // Re-issue a fresh invite token + re-send the email for a pending invite.
  resendInvite: (userId) => api.post(`/users/${userId}/resend-invite`),
  // Change an existing user's role (owner/admin/member/viewer).
  updateRole: (userId, role) => api.patch(`/users/${userId}`, { role }),
  // Cancel a pending invite (only works on users who haven't accepted yet).
  cancelInvite: (userId) => api.delete(`/users/${userId}`),
  auditLog: () => api.get('/users/audit-log'),
  // Log a whitelisted client-side event (e.g. first_dashboard_viewed).
  // Fire-and-forget — failures must never block the UI.
  logEvent: (event, detail) => api.post('/users/events', { event, detail: detail || '' }),
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
  // Live per-step validation — body: { file_id?, steps[] }
  // Returns { errors: [{step_index, error}], input_columns: [...] }
  validate: (data) => api.post('/pipelines/validate', data),
}


export const budgetApi = {
  listBudgets: () => api.get('/budget/budgets'),
  // 2.0 summary response includes: entries, totals, periods (trend), alerts,
  // departments, available_periods.
  getSummary: (name, period) => api.get('/budget/' + encodeURIComponent(name) + '/summary', { params: period ? { period } : {} }),
  // Drill-down: one category across every period of a budget.
  getCategoryDetail: (name, category) => api.get('/budget/' + encodeURIComponent(name) + '/categories/' + encodeURIComponent(category)),
  upload: (data) => api.post('/budget/upload', data),
  deleteBudget: (name) => api.delete('/budget/' + encodeURIComponent(name)),
}

export const dashboardsApi = {
  list: () => api.get('/dashboards/'),
  create: (data) => api.post('/dashboards/', data),
  update: (id, data) => api.put('/dashboards/' + id, data),
  delete: (id) => api.delete('/dashboards/' + id),
  share: (id) => api.post('/dashboards/' + id + '/share'),
  // Configure expiry, password, embed flag, or regenerate the token.
  updateShareSettings: (id, data) => api.patch('/dashboards/' + id + '/share-settings', data),
  // Most-recent dashboard for one-click "Pin to dashboard" (returns null if none).
  mostRecent: () => api.get('/dashboards/most-recent'),
  // Pin a widget. Pass id 'auto' to auto-create/reuse a "Pinned widgets" dashboard.
  pinWidget: (id, widget) => api.post('/dashboards/' + id + '/pin-widget', widget),
}

export const sheetsApi = {
  // Public-sheet mode (no OAuth — "Anyone with the link can view")
  connect: (url, name) => api.post('/sheets/connect', { url, display_name: name || '' }),
  sync: (fileId) => api.post('/sheets/' + fileId + '/sync'),

  // OAuth mode (Google Sheets 2.0 — private sheets + scheduled sync)
  authUrl: () => api.get('/sheets/oauth/auth-url'),
  status: () => api.get('/sheets/oauth/status'),
  disconnect: () => api.delete('/sheets/oauth/disconnect'),
  listSheets: (query = '') => api.get('/sheets/oauth/list-sheets', { params: query ? { query } : {} }),
  sheetTabs: (spreadsheetId) => api.get('/sheets/oauth/sheet-tabs', { params: { spreadsheet_id: spreadsheetId } }),
  connectPrivate: (data) => api.post('/sheets/oauth/connect-sheet', data),

  // Per-file sync schedule (hourly / daily / off)
  getSyncSchedule: (fileId) => api.get('/sheets/' + fileId + '/sync-schedule'),
  setSyncSchedule: (fileId, frequency) => api.post('/sheets/' + fileId + '/sync-schedule', { frequency }),
  scheduledSyncs: () => api.get('/sheets/scheduled-syncs'),
}

// Public share — no auth required. Uses raw axios so the JWT interceptor
// doesn't redirect on a 401 for an unauthenticated viewer.
const publicClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
})
export const shareApi = {
  get: (token) => publicClient.get('/share/' + encodeURIComponent(token)),
}

export const scheduledReportsApi = {
  list: () => api.get('/scheduled-reports/'),
  create: (data) => api.post('/scheduled-reports/', data),
  update: (id, data) => api.put('/scheduled-reports/' + id, data),
  remove: (id) => api.delete('/scheduled-reports/' + id),
  toggle: (id) => api.patch('/scheduled-reports/' + id + '/toggle'),
  sendNow: (id) => api.post('/scheduled-reports/' + id + '/send-now'),
  // 2.0: template catalogue + per-schedule delivery history.
  templates: () => api.get('/scheduled-reports/templates'),
  deliveries: (id, limit = 50) => api.get('/scheduled-reports/' + id + '/deliveries', { params: { limit } }),
}

export const calculatedFieldsApi = {
  list: () => api.get('/calculated-fields/'),
  save: (data) => api.post('/calculated-fields/', data),
  preview: (data) => api.post('/calculated-fields/preview', data),
  export: (data) => api.post('/calculated-fields/export', data, { responseType: 'blob' }),
  delete: (id) => api.delete('/calculated-fields/' + id),
}

// RFM 2.0 — server-side compute + custom segments + CSV export + LLM actions
export const rfmApi = {
  defaults: () => api.get('/rfm/segments/defaults'),
  analyze: (data) => api.post('/rfm/analyze', data),
  export: (data) => api.post('/rfm/export', data, { responseType: 'blob' }),
  aiAction: (data) => api.post('/rfm/ai-action', data),
}

// Organisation-level settings & add-on entitlements
export const organisationApi = {
  get: () => api.get('/organisation/'),
  setAiEnabled: (enabled) => api.patch('/organisation/ai-enabled', { enabled }),
  requestAiAccess: () => api.post('/organisation/request-ai-access'),
}

// Platform super-admin dashboard. Every endpoint here is gated on
// `is_superuser` server-side and returns 404 if the caller isn't one,
// so the UI should only render these after checking `user.is_superuser`.
export const adminApi = {
  overview: () => api.get('/admin/overview'),

  listOrganisations: (params = {}) => api.get('/admin/organisations', { params }),
  getOrganisation: (id) => api.get('/admin/organisations/' + id),
  patchOrganisation: (id, data) => api.patch('/admin/organisations/' + id, data),

  listUsers: (params = {}) => api.get('/admin/users', { params }),
  patchUser: (id, data) => api.patch('/admin/users/' + id, data),
  // Spin up a brand-new org + owner user (bypasses the gated public register
  // flow). Use only from the AdminUsers "Create test account" modal.
  provisionAccount: (data) => api.post('/admin/provision-account', data),

  listAiRequests: (params = {}) => api.get('/admin/ai-requests', { params }),
  approveAiRequest: (id, note = '') => api.post('/admin/ai-requests/' + id + '/approve', { note }),
  denyAiRequest: (id, note = '') => api.post('/admin/ai-requests/' + id + '/deny', { note }),

  billing: () => api.get('/admin/billing'),
  usage: (window = '30d') => api.get('/admin/usage', { params: { window } }),
}

export default api
