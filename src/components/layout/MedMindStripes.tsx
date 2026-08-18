// Atmosfera de marca: listras/colunata com o "batimento" (QRS) percorrendo e
// deformando cada coluna. Estilos e animações em globals.css (.mm-*).
// Decorativa: aria-hidden + pointer-events-none; respeita "reduzir movimento".

export function MedMindStripes({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`mm-stripes ${className}`}>
      <div className="mm-cols">
        {Array.from({ length: 11 }).map((_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className="mm-sweep" />
    </div>
  )
}
