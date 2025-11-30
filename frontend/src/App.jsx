import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home.jsx';
import TopGames from './pages/TopGames.jsx';
import Overview from './pages/Overview.jsx';
import Profile from './pages/Profile.jsx';
import { useAuth } from './hooks/useAuth.js';

const AppLayout = () => {
  const { user, logout, openAuthDialog, favorites } = useAuth();
  const displayName = user?.display_name ?? user?.displayName ?? user?.email;

  return (
    <div className="app-bg">
      <nav className="navbar navbar-dark bg-dark mb-4">
        <div className="container d-flex flex-column flex-lg-row gap-3 justify-content-between align-items-lg-center align-items-start">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-steam" /> Steam Game Reviews
          </span>
          <div className="d-flex flex-wrap gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-light'}`}
            >
              <i className="bi bi-speedometer2" /> Visão Geral
            </NavLink>
            <NavLink
              to="/explorar"
              className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-light'}`}
            >
              <i className="bi bi-search" /> Explorar
            </NavLink>
            <NavLink
              to="/top"
              className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-light'}`}
            >
              <i className="bi bi-trophy" /> Top Jogos
            </NavLink>
            {user ? (
              <NavLink
                to="/perfil"
                className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-light'}`}
              >
                <i className="bi bi-person" /> Perfil
              </NavLink>
            ) : null}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            {user ? (
              <>
                <span className="text-white-50 small">
                  Olá, {displayName}
                  {favorites?.length ? (
                    <span className="badge bg-success ms-2">
                      {favorites.length}
                      {' '}
                      favoritos
                    </span>
                  ) : null}
                </span>
                <NavLink to="/perfil" className="btn btn-outline-light btn-sm">
                  <i className="bi bi-person-circle" /> Perfil
                </NavLink>
                <button type="button" className="btn btn-outline-danger btn-sm" onClick={logout}>
                  <i className="bi bi-box-arrow-right" /> Sair
                </button>
              </>
            ) : (
              <>
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => openAuthDialog('login')}>
                  Entrar
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuthDialog('register')}>
                  Criar conta
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
      <div className="container pb-5">
        <Outlet />
      </div>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Overview />} />
          <Route path="/explorar" element={<Home />} />
          <Route path="/analisar" element={<Navigate to="/explorar" replace />} />
          <Route path="/top" element={<TopGames />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
