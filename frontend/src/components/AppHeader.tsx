import { useAuth } from '../auth/session'
import './AppHeader.css'

export function AppHeader() {
  const { user, logout } = useAuth()
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <span className="app-header__mark" />
        Radiomics Workbench
      </div>
      <div className="app-header__user">
        <span>{user?.fullName}</span>
        <button type="button" onClick={logout}>
          Sign out
        </button>
      </div>
    </header>
  )
}
