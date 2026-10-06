export const LOGIN_ROUTE             = '/login'
export const DASHBOARD_ROUTE         = '/dashboard'
export const RANKING_ROUTE           = '/ranking'

export const shareCardRoute        = (consultationId: string) => `/api/share/${consultationId}`

export const patientDetailRoute    = (id: string) => `/patients/${id}`
export const consultationRoute     = (id: string) => `/consultations/${id}`
