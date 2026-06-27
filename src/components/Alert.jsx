function Alert({ type = 'error', children }) {
  if (!children) return null

  return (
    <div className={`alert ${type}`} role="alert">
      {children}
    </div>
  )
}

export default Alert
