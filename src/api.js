import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8081',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000
})

export const employeeApi = {
  list: (params) => api.get('/employees', { params }),
  search: (keyword, params) => api.get('/employees/search', { params: { keyword, ...params } }),
  byDepartment: (departmentId, params) => api.get(`/employees/department/${departmentId}`, { params }),
  byStatus: (status, params) => api.get(`/employees/status/${status}`, { params }),
  get: (id) => api.get(`/employees/${id}`),
  create: (body) => api.post('/employees', body),
  update: (id, body) => api.put(`/employees/${id}`, body),
  remove: (id) => api.delete(`/employees/${id}`)
}

export const lookupApi = {
  departments: () => api.get('/departments'),
  designations: () => api.get('/designations')
}

export function errorMessage(error) {
  if (error?.response?.data?.message) return error.response.data.message
  if (error?.response?.data?.detail) return error.response.data.detail
  if (error?.response?.status === 404) return 'The requested record or API endpoint was not found (404).'
  if (error?.response?.status === 400) return 'The request was invalid. Check the form fields and try again.'
  if (error?.response?.status === 409) return 'This record conflicts with an existing record, such as a duplicate email.'
  if (error?.code === 'ERR_NETWORK') return 'Cannot reach the backend. Make sure Spring Boot is running on http://localhost:8081 and CORS is enabled.'
  if (error?.code === 'ECONNABORTED') return 'The backend request timed out. Please try again.'
  return error?.message || 'Something went wrong. Please try again.'
}

export default api