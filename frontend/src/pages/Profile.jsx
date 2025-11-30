import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AlertStack from '../components/AlertStack.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { useAuth } from '../hooks/useAuth.js';
import { formatNumber } from '../utils/formatters.js';

const Profile = () => {
  const { alerts, pushAlert, dismissAlert } = useAlerts();
  const { user, favorites, openAuthDialog, toggleFavorite, requireAuth } = useAuth();
  const [pending, setPending] = useState(() => new Set());

  const stats = useMemo(() => {
    if (!favorites.length) {
      return { totalFavorites: 0, totalReviews: 0, positiveRate: 0 };
    }
    const totalReviews = favorites.reduce((sum, fav) => sum + (fav.total_reviews ?? 0), 0);
    const totalPositive = favorites.reduce((sum, fav) => sum + (fav.total_positive ?? 0), 0);
    const positiveRate = totalReviews === 0 ? 0 : (totalPositive / totalReviews) * 100;
    return {
      totalFavorites: favorites.length,
      totalReviews,
      positiveRate,
    };
  }, [favorites]);

  const setFavoritePending = useCallback((appId, isPending) => {
    setPending((prev) => {
      const next = new Set(prev);
      if (!appId) {
        return prev;
      }
      if (isPending) {
        next.add(appId);
      } else {
        next.delete(appId);
      }
      return next;
    });
  }, []);

  const handleRemove = useCallback(
    async (appId, name) => {
      if (!requireAuth()) {
        openAuthDialog('login');
        return;
      }
      const normalized = appId?.toString();
      setFavoritePending(normalized, true);
      try {
        await toggleFavorite(normalized);
        pushAlert(`Jogo "${name}" removido dos favoritos.`, 'success');
      } catch (error) {
        pushAlert(error.message ?? 'Não foi possível remover o favorito.', 'danger');
      } finally {
        setFavoritePending(normalized, false);
      }
    },
    [openAuthDialog, pushAlert, requireAuth, setFavoritePending, toggleFavorite],
  );

  if (!user) {
    return (
      <div className="card shadow-sm">
        <div className="card-body text-center py-5">
          <h4>Faça login para acessar o perfil</h4>
          <p className="text-muted">Salve jogos favoritos e acompanhe métricas personalizadas.</p>
          <div className="d-flex justify-content-center gap-3">
            <button type="button" className="btn btn-outline-secondary" onClick={() => openAuthDialog('login')}>
              Entrar
            </button>
            <button type="button" className="btn btn-primary" onClick={() => openAuthDialog('register')}>
              Criar conta
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />

      <section className="card shadow-sm mb-4">
        <div className="card-body d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
          <div>
            <p className="text-muted mb-1">Perfil</p>
            <h3 className="mb-1">{user.display_name ?? user.displayName ?? user.email}</h3>
            <p className="text-muted mb-0">Conta criada em {new Date(user.created_at ?? Date.now()).toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="d-flex gap-3">
            <div>
              <p className="text-muted mb-1">Favoritos</p>
              <h4 className="mb-0">{stats.totalFavorites}</h4>
            </div>
            <div>
              <p className="text-muted mb-1">Reviews totais</p>
              <h4 className="mb-0">{formatNumber(stats.totalReviews)}</h4>
            </div>
            <div>
              <p className="text-muted mb-1">Taxa positiva média</p>
              <h4 className="mb-0">{stats.positiveRate.toFixed(1)}%</h4>
            </div>
          </div>
        </div>
      </section>

      {favorites.length ? (
        <section className="row g-4">
          {favorites.map((fav) => {
            const positivePerc = fav.total_reviews ? ((fav.total_positive / fav.total_reviews) * 100).toFixed(1) : '0.0';
            return (
              <div key={fav.app_id} className="col-12 col-md-6 col-xl-4">
                <div className="card h-100 shadow-sm">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start gap-2">
                      <div>
                        <h5 className="mb-1">{fav.name ?? `App ${fav.app_id}`}</h5>
                        <p className="text-muted small mb-2">AppID: {fav.app_id}</p>
                      </div>
                      <span className="badge bg-success-subtle text-success fw-semibold">{positivePerc}% positivas</span>
                    </div>
                    <p className="text-muted small mb-3">{fav.review_score_desc ?? 'Sem descrição'}</p>
                    <div className="mb-3">
                      <div className="d-flex justify-content-between small">
                        <span>Total de reviews</span>
                        <strong>{formatNumber(fav.total_reviews ?? 0)}</strong>
                      </div>
                      <div className="d-flex justify-content-between small text-success">
                        <span>Positivas</span>
                        <strong>{formatNumber(fav.total_positive ?? 0)}</strong>
                      </div>
                      <div className="d-flex justify-content-between small text-danger">
                        <span>Negativas</span>
                        <strong>{formatNumber(fav.total_negative ?? 0)}</strong>
                      </div>
                    </div>
                    <div className="mt-auto d-flex gap-2">
                      <Link to={`/explorar?appId=${fav.app_id}`} className="btn btn-outline-primary flex-fill">
                        <i className="bi bi-graph-up" /> Analisar
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline-danger"
                        onClick={() => handleRemove(fav.app_id, fav.name ?? fav.app_id)}
                        disabled={pending.has(fav.app_id?.toString())}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      ) : (
        <div className="card shadow-sm">
          <div className="card-body text-center py-5">
            <h5>Nenhum favorito por aqui</h5>
            <p className="text-muted">Marque jogos na página Explorar ou em Top Jogos para vê-los aqui.</p>
            <div className="d-flex justify-content-center gap-3">
              <Link to="/explorar" className="btn btn-primary">
                <i className="bi bi-search" /> Explorar jogos
              </Link>
              <Link to="/top" className="btn btn-outline-secondary">
                <i className="bi bi-trophy" /> Ver ranking
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Profile;
