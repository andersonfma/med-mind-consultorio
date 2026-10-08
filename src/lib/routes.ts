export const LOGIN_ROUTE             = '/login'
export const DASHBOARD_ROUTE         = '/dashboard'
export const RANKING_ROUTE           = '/ranking'

export const shareCardRoute        = (consultationId: string) => `/api/share/${consultationId}`
export const publicCardRoute       = (consultationId: string) => `/c/${consultationId}`

export const FEED_ROUTE            = '/feed'
export const CHALLENGE_ROUTE       = '/desafio'
export const EDIT_PROFILE_ROUTE    = '/perfil/editar'
export const REQUESTS_ROUTE        = '/solicitacoes'
export const RESULTS_ROUTE         = '/resultados'

export const profileRoute          = (handle: string) => `/u/${handle}`
export const postRoute             = (id: string) => `/post/${id}`

export const patientDetailRoute    = (id: string) => `/patients/${id}`
export const consultationRoute     = (id: string) => `/consultations/${id}`
