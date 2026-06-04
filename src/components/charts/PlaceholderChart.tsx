export function PlaceholderChart({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
          Em breve
        </span>
      </div>
      <p className="text-xs text-gray-400 mb-4">{description}</p>
      <svg
        className="w-full h-24 text-gray-200"
        viewBox="0 0 200 60"
        aria-hidden="true"
      >
        <polyline
          points="0,50 40,30 80,40 120,10 160,25 200,20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    </div>
  )
}
