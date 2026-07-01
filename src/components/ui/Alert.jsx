export default function Alert({ type = 'info', title, children, className = '' }) {
  const styles = {
    info:    'bg-blue-50 border-blue-200 text-blue-800',
    success: 'bg-green-50 border-green-200 text-green-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    error:   'bg-red-50 border-red-200 text-red-800',
  }
  return (
    <div className={`border rounded-lg p-4 ${styles[type]} ${className}`}>
      {title && <p className="font-medium mb-1">{title}</p>}
      <p className="text-sm">{children}</p>
    </div>
  )
}
