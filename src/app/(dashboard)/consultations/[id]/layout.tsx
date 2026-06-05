import { type ReactNode } from 'react'

export default function ConsultationLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {children}
    </div>
  )
}
