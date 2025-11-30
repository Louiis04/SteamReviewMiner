import { BrowserRouter, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './App.css';
import Home from './pages/Home.jsx';
import TopGames from './pages/TopGames.jsx';

const AppLayout = () => (
  <div className="app-bg">
    <nav className="navbar navbar-dark bg-dark mb-4">
      <div className="container d-flex justify-content-between align-items-center">
        <span className="navbar-brand mb-0 h1">
          <i className="bi bi-steam" /> Steam Game Reviews
        </span>
        <div className="d-flex gap-2">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-light'}`}
          >
            <i className="bi bi-house" /> Início
          </NavLink>
          <NavLink
            to="/top"
            className={({ isActive }) => `btn btn-sm ${isActive ? 'btn-primary' : 'btn-outline-light'}`}
          >
            <i className="bi bi-trophy" /> Top Jogos
          </NavLink>
        </div>
      </div>
    </nav>
    <div className="container pb-5">
      <Outlet />
    </div>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/top" element={<TopGames />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
