import { Link, useLocation } from 'react-router-dom'
import { ConnectWallet } from './ConnectWallet'

export function Navigation() {
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="main-nav">
      <div className="nav-brand">
        <Link to="/">
          <strong>Walrus Haulout</strong>
        </Link>
      </div>

      <div className="nav-links">
        <Link
          to="/"
          className={isActive('/') && !isActive('/datasets') ? 'active' : ''}
        >
          Home
        </Link>
        <Link
          to="/datasets"
          className={isActive('/datasets') ? 'active' : ''}
        >
          Datasets
        </Link>
      </div>

      <div className="nav-actions">
        <ConnectWallet />
      </div>
    </nav>
  )
}
