export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Med Mind</h1>
          <p className="text-sm text-gray-500 mt-1">Módulo Consultório</p>
        </div>
        {children}
      </div>
    </div>
  )
}
