import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AlertStack from '../components/AlertStack.jsx';
import CommentsModal from '../components/CommentsModal.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { API_BASE_URL } from '../config.js';
import { formatNumber } from '../utils/formatters.js';
import { useAuth } from '../hooks/useAuth.js';

const GAMES_PER_PAGE = 10;

const initialModalState = {
  open: false,
  title: '',
  comments: [],
  loading: false,
  cursor: '',
  appId: null,
  keywordsMode: false,
  keywords: [],
  language: 'all',
  availableLanguages: [],
  total: 0,
};

const sortOptions = [
  { value: 'rating', label: 'Melhor Avaliação' },
  { value: 'reviews', label: 'Mais Avaliações' },
  { value: 'recent', label: 'Mais Recentes' },
];

const reviewOptions = [
  { value: '10', label: '10+' },
  { value: '50', label: '50+' },
  { value: '100', label: '100+' },
  { value: '500', label: '500+' },
  { value: '1000', label: '1000+' },
  { value: '5000', label: '5000+' },
];

const limitOptions = [
  { value: '20', label: '20 jogos' },
  { value: '50', label: '50 jogos' },
  { value: '100', label: '100 jogos' },
  { value: 'all', label: 'Todos' },
];

const rankClassMap = {
  1: 'gold',
  2: 'silver',
  3: 'bronze',
};

const getRatingClass = (percentage) => {
  if (percentage >= 90) return 'excellent';
  if (percentage >= 75) return 'good';
  return 'average';
};

const TopGameCard = ({ game, rank, onShowComments, onToggleFavorite, isFavorite, favoriteDisabled }) => {
  const positivePercentage = Number(game.positive_percentage ?? 0).toFixed(1);
  const ratingClass = getRatingClass(Number(positivePercentage));
  const developers = game.developers || '';

  return (
    <div className="col">
      <div className="card game-card shadow h-100">
        <div className={`game-rank ${rankClassMap[rank] || ''}`}>{rank}</div>
        <div className="card-body p-3">
          <div className="position-relative mb-3">
            <img
              src={game.header_image ?? `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`}
              alt={game.name}
              className="game-thumbnail"
              onError={(event) => {
                // eslint-disable-next-line no-param-reassign
                event.currentTarget.src = 'https://via.placeholder.com/460x215?text=Sem+Imagem';
              }}
            />
            <div className={`rating-badge ${ratingClass}`}>{positivePercentage}%</div>
          </div>

          <h5 className="game-title">{game.name}</h5>
          {game.short_description ? <p className="game-description">{game.short_description}</p> : null}

          <div className="game-stats">
            <div className="stat-row">
              <span className="stat-label">
                <i className="bi bi-star-fill text-warning" /> Avaliação:
              </span>
              <span className="stat-value">{game.review_score_desc ?? 'N/A'}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">
                <i className="bi bi-chat-square-text" /> Total:
              </span>
              <span className="stat-value">{formatNumber(game.total_reviews)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">
                <i className="bi bi-hand-thumbs-up-fill text-success" /> Positivas:
              </span>
              <span className="stat-value text-success">{formatNumber(game.total_positive)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">
                <i className="bi bi-hand-thumbs-down-fill text-danger" /> Negativas:
              </span>
              <span className="stat-value text-danger">{formatNumber(game.total_negative)}</span>
            </div>
          </div>

          <div className="progress mb-3">
            <div className="progress-bar bg-success" role="progressbar" style={{ width: `${positivePercentage}%` }}>
              {positivePercentage}% Positivas
            </div>
          </div>

          {developers ? (
            <p className="text-muted small mb-2">
              <i className="bi bi-code-square" /> {developers}
            </p>
          ) : null}

          <div className="game-footer flex-column gap-2">
            <button
              type="button"
              className={`btn btn-view-comments ${isFavorite ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
              onClick={onToggleFavorite}
              disabled={favoriteDisabled}
            >
              <i className={isFavorite ? 'bi bi-star-fill' : 'bi bi-star'} />{' '}
              {isFavorite ? 'Nos favoritos' : 'Favoritar'}
            </button>
            <div className="d-flex gap-2">
              <button className="btn btn-primary btn-view-comments flex-fill" onClick={onShowComments}>
                <i className="bi bi-chat-left-text" /> Ver Comentários
              </button>
              <a
                href={`https://store.steampowered.com/app/${game.app_id}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-dark btn-steam-link"
              >
                <i className="bi bi-steam" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingState = () => (
  <div className="text-center py-5">
    <div className="spinner-border text-primary" style={{ width: '3rem', height: '3rem' }} role="status">
      <span className="visually-hidden">Carregando...</span>
    </div>
    <p className="mt-3 text-muted">Carregando jogos...</p>
  </div>
);

const EmptyState = ({ onPreload, loadingPreload }) => (
  <div id="emptyState" className="text-center py-5">
    <i className="bi bi-inbox" style={{ fontSize: '5rem', color: '#ccc' }} />
    <h3 className="mt-4 text-muted">Nenhum jogo encontrado no banco de dados</h3>
    <p className="text-muted">Para popular o banco de dados com jogos:</p>
    <div className="alert alert-info d-inline-block text-start mt-3" style={{ maxWidth: 600 }}>
      <strong>Opção 1:</strong> Use a página inicial para buscar jogos individualmente.
      <br />
      <strong>Opção 2:</strong> Execute o pré-carregamento acessando:
      <br />
      <button type="button" className="btn btn-primary btn-sm mt-2" onClick={onPreload} disabled={loadingPreload}>
        {loadingPreload ? (
          <>
            <span className="spinner-border spinner-border-sm" /> Iniciando...
          </>
        ) : (
          <>
            <i className="bi bi-download" /> Iniciar Pré-carregamento de 100 Jogos
          </>
        )}
      </button>
    </div>
    <p className="text-muted small mt-3">
      <i className="bi bi-info-circle" /> O pré-carregamento roda em background e pode levar alguns minutos.
    </p>
  </div>
);

const Pagination = ({ totalPages, currentPage, onChange }) => {
  if (totalPages <= 1) {
    return null;
  }

  const pages = [];
  const maxVisiblePages = 7;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

  if (endPage - startPage < maxVisiblePages - 1) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }

  if (startPage > 1) {
    pages.push(1);
    if (startPage > 2) {
      pages.push('start-ellipsis');
    }
  }

  for (let page = startPage; page <= endPage; page += 1) {
    pages.push(page);
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      pages.push('end-ellipsis');
    }
    pages.push(totalPages);
  }

  return (
    <nav id="paginationArea" className="mt-4" aria-label="Navegação de páginas">
      <ul className="pagination justify-content-center">
        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(currentPage - 1)}>
            <i className="bi bi-chevron-left" /> Anterior
          </button>
        </li>
        {pages.map((page, index) => {
          if (page === 'start-ellipsis' || page === 'end-ellipsis') {
            return (
              <li key={`${page}-${index}`} className="page-item disabled">
                <span className="page-link">...</span>
              </li>
            );
          }
          return (
            <li key={page} className={`page-item ${page === currentPage ? 'active' : ''}`}>
              <button type="button" className="page-link" onClick={() => onChange(page)}>
                {page}
              </button>
            </li>
          );
        })}
        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
          <button type="button" className="page-link" onClick={() => onChange(currentPage + 1)}>
            Próximo <i className="bi bi-chevron-right" />
          </button>
        </li>
      </ul>
    </nav>
  );
};

const TopGames = () => {
  const { alerts, pushAlert, dismissAlert } = useAlerts();
  const { user, favorites, toggleFavorite, requireAuth, openAuthDialog } = useAuth();
  const [filters, setFilters] = useState({ sort: 'rating', minReviews: '100', limit: '50' });
  const [games, setGames] = useState([]);
  const [allGames, setAllGames] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [statsTotal, setStatsTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [modalState, setModalState] = useState(initialModalState);
  const [isEmpty, setIsEmpty] = useState(false);
  const [preloadLoading, setPreloadLoading] = useState(false);
  const [favoritePending, setFavoritePending] = useState(() => new Set());

  const favoritesSet = useMemo(
    () => new Set(favorites.map((fav) => fav.app_id?.toString())),
    [favorites],
  );

  const setPending = useCallback((appId, pending) => {
    setFavoritePending((prev) => {
      const next = new Set(prev);
      if (!appId) {
        return prev;
      }
      if (pending) {
        next.add(appId);
      } else {
        next.delete(appId);
      }
      return next;
    });
  }, []);

  const isPaginated = filters.limit === 'all';

  const paginatedGames = useMemo(() => {
    if (!isPaginated) {
      return [];
    }
    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    return allGames.slice(startIndex, startIndex + GAMES_PER_PAGE);
  }, [allGames, currentPage, isPaginated]);

  const displayedGames = isPaginated ? paginatedGames : games;
  const totalPages = isPaginated ? Math.ceil(allGames.length / GAMES_PER_PAGE) : 0;

  const fetchComments = useCallback(
    async (appId, cursor = '*', append = false, language = 'all') => {
      try {
        const normalizedLanguage = (language || 'all').toLowerCase();
        setModalState((prev) => ({
          ...prev,
          loading: true,
          language: normalizedLanguage,
          comments: append ? prev.comments : [],
          cursor: append ? prev.cursor : '',
        }));
        const params = new URLSearchParams({
          num_per_page: '10',
          cursor: cursor ?? '*',
          language: normalizedLanguage,
        });
        const response = await fetch(`${API_BASE_URL}/game/comments/${appId}?${params.toString()}`);
        const data = await response.json();
        if (!data.success) {
          throw new Error('Erro ao carregar comentários.');
        }
        setModalState((prev) => ({
          ...prev,
          loading: false,
          cursor: data.cursor ?? '',
          comments: append ? [...prev.comments, ...(data.reviews ?? [])] : data.reviews ?? [],
          availableLanguages: data.availableLanguages ?? prev.availableLanguages ?? [],
          language: data.activeLanguage ?? normalizedLanguage,
          total: data.total ?? prev.total,
        }));
      } catch (error) {
        setModalState((prev) => ({ ...prev, loading: false }));
        pushAlert(error.message ?? 'Erro ao carregar comentários.', 'danger');
      }
    },
    [pushAlert],
  );

  const handleShowComments = useCallback(
    (game) => {
      setModalState({
        ...initialModalState,
        open: true,
        title: `Comentários - ${game.name}`,
        appId: game.app_id,
      });
      fetchComments(game.app_id, '*', false, 'all');
    },
    [fetchComments],
  );

  const loadTopGames = useCallback(async () => {
    setIsLoading(true);
    setIsEmpty(false);
    const fetchLimit = filters.limit === 'all' ? 10000 : filters.limit;
    try {
      const params = new URLSearchParams({
        sort: filters.sort,
        min_reviews: filters.minReviews,
        limit: fetchLimit,
      });
      const response = await fetch(`${API_BASE_URL}/top-games?${params.toString()}`);
      const data = await response.json();
      if (data.success && data.games?.length) {
        setStatsTotal(data.games.length);
        if (filters.limit === 'all') {
          setAllGames(data.games);
          setGames([]);
        } else {
          setGames(data.games);
          setAllGames([]);
        }
      } else {
        setGames([]);
        setAllGames([]);
        setStatsTotal(0);
        setIsEmpty(true);
      }
    } catch (error) {
      setGames([]);
      setAllGames([]);
      setStatsTotal(0);
      setIsEmpty(true);
      pushAlert('Erro ao carregar jogos. Verifique se o servidor está rodando.', 'danger');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pushAlert]);

  useEffect(() => {
    setCurrentPage(1);
    loadTopGames();
  }, [loadTopGames]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreload = async () => {
    try {
      setPreloadLoading(true);
      const response = await fetch(`${API_BASE_URL}/preload?limit=100`);
      const data = await response.json();
      if (data.success) {
        pushAlert(`Pré-carregamento iniciado: ${data.total} jogos em processamento.`, 'success');
      } else {
        pushAlert('Erro ao iniciar pré-carregamento.', 'danger');
      }
    } catch (error) {
      pushAlert('Erro ao iniciar pré-carregamento.', 'danger');
    } finally {
      setPreloadLoading(false);
    }
  };

  const handlePageChange = (page) => {
    if (page < 1) return;
    if (page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rankOffset = isPaginated ? (currentPage - 1) * GAMES_PER_PAGE : 0;

  const handleToggleFavorite = useCallback(
    async (game) => {
      const appId = game.app_id?.toString();
      if (!appId) {
        return;
      }
      if (!requireAuth()) {
        pushAlert('Faça login para salvar favoritos.', 'info');
        return;
      }
      const alreadyFavorite = favoritesSet.has(appId);
      setPending(appId, true);
      try {
        await toggleFavorite(appId);
        pushAlert(
          alreadyFavorite
            ? `Jogo "${game.name}" removido dos favoritos.`
            : `Jogo "${game.name}" adicionado aos favoritos.`,
          'success',
        );
      } catch (error) {
        pushAlert(error.message ?? 'Erro ao atualizar favoritos.', 'danger');
      } finally {
        setPending(appId, false);
      }
    },
    [favoritesSet, pushAlert, requireAuth, setPending, toggleFavorite],
  );

  return (
    <>
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">
            <i className="bi bi-trophy-fill text-warning" /> Jogos Melhores Avaliados
          </h5>
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label" htmlFor="sortSelect">
                Ordenar por
              </label>
              <select
                id="sortSelect"
                className="form-select"
                value={filters.sort}
                onChange={(event) => handleFilterChange('sort', event.target.value)}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="minReviewsSelect">
                Mínimo de avaliações
              </label>
              <select
                id="minReviewsSelect"
                className="form-select"
                value={filters.minReviews}
                onChange={(event) => handleFilterChange('minReviews', event.target.value)}
              >
                {reviewOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label" htmlFor="limitSelect">
                Quantidade
              </label>
              <select
                id="limitSelect"
                className="form-select"
                value={filters.limit}
                onChange={(event) => handleFilterChange('limit', event.target.value)}
              >
                {limitOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 d-flex align-items-end">
              <button type="button" className="btn btn-primary w-100" onClick={loadTopGames} disabled={isLoading}>
                <i className="bi bi-arrow-clockwise" /> Atualizar Lista
              </button>
            </div>
          </div>

            {user ? (
              <div className="alert alert-warning d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                <div>
                  <strong>{favorites.length}</strong> jogos salvos.
                  {' '}
                  Marque favoritos diretamente no ranking e acompanhe tudo na sua página de perfil.
                </div>
                <Link to="/perfil" className="btn btn-sm btn-outline-dark text-nowrap">
                  <i className="bi bi-person" /> Abrir perfil
                </Link>
              </div>
            ) : (
              <div className="alert alert-secondary d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                <div>Crie uma conta para salvar jogos do ranking e acessá-los rapidamente.</div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-dark btn-sm" onClick={() => openAuthDialog('login')}>
                    Entrar
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openAuthDialog('register')}>
                    Criar conta
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          {statsTotal > 0 ? (
            <div className="alert alert-info" role="status">
              <i className="bi bi-info-circle" /> Mostrando <strong>{statsTotal}</strong> jogos
            </div>
          ) : null}

          {isEmpty ? (
            <EmptyState onPreload={handlePreload} loadingPreload={preloadLoading} />
          ) : (
            <>
              <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 row-cols-xl-4 g-4">
                {displayedGames.map((game, index) => (
                  <TopGameCard
                    key={game.app_id}
                    game={game}
                    rank={rankOffset + index + 1}
                    onShowComments={() => handleShowComments(game)}
                    onToggleFavorite={() => handleToggleFavorite(game)}
                    isFavorite={favoritesSet.has(game.app_id?.toString())}
                    favoriteDisabled={favoritePending.has(game.app_id?.toString())}
                  />
                ))}
              </div>
              {isPaginated ? (
                <Pagination totalPages={totalPages} currentPage={currentPage} onChange={handlePageChange} />
              ) : null}
            </>
          )}
        </>
      )}

      <CommentsModal
        state={modalState}
        onClose={() => setModalState(initialModalState)}
        onLoadMore={() => {
          if (modalState.appId && modalState.cursor) {
            fetchComments(modalState.appId, modalState.cursor, true, modalState.language);
          }
        }}
        onChangeLanguage={(nextLanguage) => {
          if (modalState.appId) {
            fetchComments(modalState.appId, '*', false, nextLanguage);
          }
        }}
      />
    </>
  );
};

export default TopGames;
