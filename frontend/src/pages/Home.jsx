import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AlertStack from '../components/AlertStack.jsx';
import CommentsModal from '../components/CommentsModal.jsx';
import { useAlerts } from '../hooks/useAlerts.js';
import { API_BASE_URL } from '../config.js';
import { formatNumber } from '../utils/formatters.js';
import { useAuth } from '../hooks/useAuth.js';

const initialModalState = {
  open: false,
  title: '',
  comments: [],
  loading: false,
  cursor: '',
  appId: null,
  keywordsMode: false,
  keywords: [],
};

const GameCard = ({ game, onRemove, onShowComments, onToggleFavorite, isFavorite, favoriteDisabled }) => {
  const totalReviews = game.reviewsData?.total_reviews ?? 0;
  const totalPositive = game.reviewsData?.total_positive ?? 0;
  const percentage = totalReviews > 0 ? ((totalPositive / totalReviews) * 100).toFixed(1) : '0.0';

  return (
    <div className="col" id={`game-${game.appId}`}>
      <div className="card game-card shadow position-relative h-100">
        <button className="btn btn-danger btn-sm btn-remove-game" onClick={() => onRemove(game.appId)}>
          <i className="bi bi-x-lg" />
        </button>
        <div className="card-body">
          <div className="text-center mb-3">
            <img
              src={`https://cdn.akamai.steamstatic.com/steam/apps/${game.appId}/capsule_184x69.jpg`}
              alt={game.name}
              className="game-thumbnail"
              onError={(event) => {
                // eslint-disable-next-line no-param-reassign
                event.currentTarget.src = 'https://via.placeholder.com/184x69?text=Sem+Imagem';
              }}
            />
          </div>
          <h5 className="card-title text-center mb-3">{game.name}</h5>

          <div className="review-stats mb-3">
            <div className="review-percentage">{percentage}%</div>
            <div>
              <span className="review-badge">{game.reviewsData?.review_score_desc ?? 'N/A'}</span>
            </div>
          </div>

          <div className="game-info-section">
            <div className="stat-item">
              <span className="stat-label">Total de Avaliações:</span>
              <span className="stat-value">{formatNumber(totalReviews)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avaliações Positivas:</span>
              <span className="stat-value text-success">{formatNumber(totalPositive)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avaliações Negativas:</span>
              <span className="stat-value text-danger">
                {formatNumber(game.reviewsData?.total_negative ?? 0)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className={`btn w-100 mt-2 ${isFavorite ? 'btn-warning text-dark' : 'btn-outline-warning'}`}
            onClick={() => onToggleFavorite(game.appId, game.name)}
            disabled={favoriteDisabled}
          >
            <i className={isFavorite ? 'bi bi-star-fill' : 'bi bi-star'} /> {isFavorite ? 'Nos seus favoritos' : 'Favoritar'}
          </button>
          <button className="btn btn-primary w-100 mt-3" onClick={() => onShowComments(game.appId)}>
            <i className="bi bi-chat-left-text" /> Ver Comentários
          </button>
        </div>
      </div>
    </div>
  );
};

const KeywordResults = ({ state, onAddGame, onShowComments, onShowKeywordComments }) => {
  if (!state.visible) {
    return null;
  }

  if (state.loading) {
    return (
      <div id="keywordSearchResults" className="card shadow-sm mb-4">
        <div className="card-body text-center py-5">
          <div className="spinner-border text-info" role="status" />
          <p className="mt-3 text-muted">Buscando jogos nos comentários...</p>
        </div>
      </div>
    );
  }

  if (state.message) {
    return (
      <div id="keywordSearchResults" className="card shadow-sm mb-4">
        <div className="card-body text-center py-4">
          <i className="bi bi-exclamation-circle text-warning" style={{ fontSize: '3rem' }} />
          <p className="mt-2">{state.message}</p>
        </div>
      </div>
    );
  }

  if (!state.games.length) {
    return (
      <div id="keywordSearchResults" className="card shadow-sm mb-4">
        <div className="card-body text-center py-4">
          <i className="bi bi-search" style={{ fontSize: '3rem', color: '#999' }} />
          <p className="mt-2 text-muted">Nenhum jogo encontrado com essas palavras-chave.</p>
        </div>
      </div>
    );
  }

  return (
    <div id="keywordSearchResults" className="card shadow-sm mb-4">
      <div className="card-header bg-info text-white">
        <h5 className="mb-0">
          <i className="bi bi-trophy" /> Jogos Encontrados ({state.total})
        </h5>
      </div>
      <div className="card-body">
        <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3" id="keywordGamesContainer">
          {state.games.map((game, index) => (
            <div className="col" key={`${game.app_id}-${index}`}>
              <div className="card h-100 shadow-sm keyword-game-card">
                <div className="position-relative">
                  <img
                    src={game.header_image ?? `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`}
                    className="card-img-top"
                    alt={game.name}
                    onError={(event) => {
                      // eslint-disable-next-line no-param-reassign
                      event.currentTarget.src = 'https://via.placeholder.com/460x215?text=Sem+Imagem';
                    }}
                  />
                  <span className="badge bg-info position-absolute top-0 end-0 m-2">#{index + 1}</span>
                </div>
                <div className="card-body">
                  <h6 className="card-title">{game.name}</h6>
                  <div className="mb-2">
                    <span className="badge bg-success me-1">
                      {game.positive_percentage ?? 0}% Positivo
                    </span>
                    <span className="badge bg-secondary">{formatNumber(game.total_reviews ?? 0)} reviews</span>
                  </div>
                  <div className="keyword-match-info mb-2">
                    <small className="text-info">
                      <i className="bi bi-chat-dots-fill" />
                      {' '}
                      {game.comment_matches ?? 0}
                      {' '}
                      {(game.comment_matches ?? 0) === 1 ? 'comentário encontrado' : 'comentários encontrados'}
                    </small>
                    <br />
                    <small className="text-muted">
                      <i className="bi bi-star-fill" /> Score de relevância: {Math.round(game.relevance_score ?? 0)}
                    </small>
                  </div>
                  {game.short_description ? (
                    <p className="card-text small text-muted">{`${game.short_description.substring(0, 120)}...`}</p>
                  ) : null}
                  <div className="d-grid gap-2">
                    <button className="btn btn-sm btn-primary" onClick={() => onAddGame(game.app_id)}>
                      <i className="bi bi-plus-circle" /> Adicionar à Lista
                    </button>
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => onShowComments(game.app_id)}>
                      <i className="bi bi-chat-left-text" /> Ver Todos os Comentários
                    </button>
                    <button
                      className="btn btn-sm btn-outline-info"
                      onClick={() => onShowKeywordComments(game.app_id, game.name)}
                    >
                      <i className="bi bi-search" /> Ver Comentários Relevantes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SearchResultsDropdown = ({ visible, loading, results, onSelect }) => {
  if (!visible) {
    return null;
  }

  return (
    <div id="searchResults" className="search-results position-absolute w-100">
      {loading ? (
        <div className="search-loading">
          <div className="spinner-border spinner-border-sm text-primary" />
          <span className="ms-2">Buscando...</span>
        </div>
      ) : null}

      {!loading && results.length === 0 ? (
        <div className="search-no-results">
          <i className="bi bi-search" /> Nenhum jogo encontrado
        </div>
      ) : null}

      {results.map((game) => (
        <button type="button" key={game.appid} className="search-result-item w-100 text-start" onClick={() => onSelect(game)}>
          <img
            src={game.header_image}
            alt={game.name}
            className="search-result-thumbnail"
            onError={(event) => {
              // eslint-disable-next-line no-param-reassign
              event.currentTarget.src = 'https://via.placeholder.com/60x28?text=Sem+Imagem';
            }}
          />
          <div className="search-result-info">
            <div className="search-result-name">{game.name}</div>
            <div className="search-result-appid">AppID: {game.appid}</div>
          </div>
        </button>
      ))}
    </div>
  );
};

const Home = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchController = useRef();
  const searchCache = useRef(new Map());
  const searchWrapperRef = useRef(null);

  const { user, favorites, toggleFavorite, requireAuth, openAuthDialog } = useAuth();
  const [favoritePending, setFavoritePending] = useState(() => new Set());
  const favoritesSet = useMemo(() => new Set(favorites.map((fav) => fav.app_id?.toString())), [favorites]);

  const markPending = useCallback((appId, pending) => {
    setFavoritePending((prev) => {
      const next = new Set(prev);
      const id = appId?.toString();
      if (!id) {
        return prev;
      }
      if (pending) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const [games, setGames] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const { alerts, pushAlert, dismissAlert } = useAlerts();

  const [keywordInput, setKeywordInput] = useState('');
  const [keywordState, setKeywordState] = useState({ visible: false, loading: false, games: [], total: 0, message: '' });
  const [currentKeywordList, setCurrentKeywordList] = useState([]);

  const [modalState, setModalState] = useState(initialModalState);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(event.target)) {
        setSearchVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = searchTerm.trim();
    if (trimmed.length < 2 || /^\d+$/.test(trimmed)) {
      setSearchResults([]);
      setSearchVisible(false);
      setSearchLoading(false);
      return undefined;
    }

    setSearchLoading(true);
    const cacheKey = trimmed.toLowerCase();

    if (searchCache.current.has(cacheKey)) {
      setSearchResults(searchCache.current.get(cacheKey));
      setSearchVisible(true);
      setSearchLoading(false);
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      try {
        if (searchController.current) {
          searchController.current.abort();
        }
        const controller = new AbortController();
        searchController.current = controller;
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (data.success && data.games?.length) {
          searchCache.current.set(cacheKey, data.games);
          setSearchResults(data.games);
        } else {
          setSearchResults([]);
        }
        setSearchVisible(true);
      } catch (error) {
        if (error.name !== 'AbortError') {
          pushAlert('Erro ao buscar jogos. Tente novamente.', 'danger');
        }
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => {
      clearTimeout(timeoutId);
      if (searchController.current) {
        searchController.current.abort();
      }
    };
  }, [searchTerm, pushAlert]);

  const fetchGameData = useCallback(async (appId) => {
    const reviewsResponse = await fetch(`${API_BASE_URL}/game/reviews/${appId}?num_per_page=0`);
    const reviewsData = await reviewsResponse.json();
    if (!reviewsData.success) {
      throw new Error('Jogo não encontrado ou sem avaliações.');
    }

    const detailsResponse = await fetch(`${API_BASE_URL}/game/details/${appId}`);
    const detailsData = await detailsResponse.json();
    const gameName = detailsData?.[appId]?.data?.name ?? `Jogo ${appId}`;

    return {
      appId,
      name: gameName,
      reviewsData: reviewsData.query_summary,
    };
  }, []);

  const handleAddGame = useCallback(async (appIdFromButton) => {
    const rawAppId = appIdFromButton ?? selectedAppId ?? searchTerm.trim();
    if (!rawAppId || !/^\d+$/.test(rawAppId)) {
      pushAlert('Por favor, selecione um jogo ou digite um AppID válido.', 'warning');
      return;
    }

    const normalizedId = rawAppId.toString();
    if (games.some((game) => game.appId === normalizedId)) {
      pushAlert('Este jogo já foi adicionado!', 'info');
      setSearchTerm('');
      setSelectedAppId(null);
      return;
    }

    try {
      setGlobalLoading(true);
      const gameData = await fetchGameData(normalizedId);
      setGames((prev) => [...prev, gameData]);
      pushAlert(`Jogo "${gameData.name}" adicionado com sucesso!`, 'success');
      setSearchTerm('');
      setSelectedAppId(null);
    } catch (error) {
      pushAlert(error.message ?? 'Erro ao buscar informações do jogo.', 'danger');
    } finally {
      setGlobalLoading(false);
    }
  }, [fetchGameData, games, pushAlert, searchTerm, selectedAppId]);

  const handleRemoveGame = (appId) => {
    setGames((prev) => prev.filter((game) => game.appId !== appId));
  };

  const openModal = useCallback((config) => {
    setModalState({ ...initialModalState, ...config, open: true });
  }, []);

  const fetchComments = useCallback(async (appId, cursor = '*', append = false) => {
    try {
      setModalState((prev) => ({ ...prev, loading: true }));
      const response = await fetch(
        `${API_BASE_URL}/game/comments/${appId}?num_per_page=10&cursor=${encodeURIComponent(cursor)}`,
      );
      const data = await response.json();
      if (!data.success) {
        throw new Error('Erro ao carregar comentários.');
      }
      setModalState((prev) => ({
        ...prev,
        loading: false,
        cursor: data.cursor ?? '',
        comments: append ? [...prev.comments, ...(data.reviews ?? [])] : data.reviews ?? [],
      }));
    } catch (error) {
      setModalState((prev) => ({ ...prev, loading: false }));
      pushAlert(error.message ?? 'Erro ao carregar comentários.', 'danger');
    }
  }, [pushAlert]);

  const fetchKeywordComments = useCallback(async (appId, keywords) => {
    try {
      setModalState((prev) => ({ ...prev, loading: true }));
      const query = encodeURIComponent(keywords.join(','));
      const response = await fetch(`${API_BASE_URL}/game/comments/keywords/${appId}?keywords=${query}&limit=20`);
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message ?? 'Erro ao carregar comentários por palavra-chave.');
      }
      setModalState((prev) => ({ ...prev, loading: false, comments: data.comments ?? [] }));
    } catch (error) {
      setModalState((prev) => ({ ...prev, loading: false }));
      pushAlert(error.message ?? 'Erro ao carregar comentários.', 'danger');
    }
  }, [pushAlert]);

  const handleShowComments = useCallback((appId) => {
    const game = games.find((g) => g.appId === appId);
    openModal({ appId, title: `Comentários - ${game?.name ?? `Jogo ${appId}`}` });
    fetchComments(appId);
  }, [fetchComments, games, openModal]);

  const handleShowKeywordComments = useCallback((appId, gameName) => {
    if (!currentKeywordList.length) {
      pushAlert('Nenhuma palavra-chave selecionada. Faça uma busca primeiro.', 'warning');
      return;
    }
    openModal({
      appId,
      title: (
        <span>
          Comentários Relevantes - {gameName ?? `Jogo ${appId}`}
          <br />
          <small className="text-muted">Palavras-chave: {currentKeywordList.join(', ')}</small>
        </span>
      ),
      keywordsMode: true,
      keywords: currentKeywordList,
    });
    fetchKeywordComments(appId, currentKeywordList);
  }, [currentKeywordList, fetchKeywordComments, openModal, pushAlert]);

  const handleKeywordSearch = useCallback(async () => {
    const keywords = keywordInput
      .split(/[,;\s]+/)
      .map((kw) => kw.trim())
      .filter((kw) => kw.length > 0);

    if (!keywords.length) {
      pushAlert('Por favor, digite ao menos uma palavra-chave.', 'warning');
      return;
    }

    setCurrentKeywordList(keywords);
    setKeywordState({ visible: true, loading: true, games: [], total: 0, message: '' });

    try {
      const response = await fetch(`${API_BASE_URL}/search/keywords?keywords=${encodeURIComponent(keywords.join(','))}`);
      const data = await response.json();
      if (!data.success) {
        setKeywordState({ visible: true, loading: false, games: [], total: 0, message: data.message ?? 'Erro ao buscar jogos.' });
        return;
      }

      setKeywordState({
        visible: true,
        loading: false,
        games: data.games ?? [],
        total: data.total ?? (data.games?.length ?? 0),
        message: data.games?.length ? '' : 'Nenhum jogo encontrado com essas palavras-chave nos comentários.',
      });
    } catch (error) {
      setKeywordState({ visible: true, loading: false, games: [], total: 0, message: 'Erro ao buscar jogos. Tente novamente.' });
      pushAlert(error.message ?? 'Erro ao buscar jogos.', 'danger');
    }
  }, [keywordInput, pushAlert]);

  const handleToggleFavorite = useCallback(async (appId, gameName) => {
    const normalizedId = appId?.toString();
    if (!normalizedId) {
      return;
    }
    if (!requireAuth()) {
      pushAlert('Faça login para salvar jogos favoritos.', 'info');
      return;
    }
    const alreadyFavorite = favoritesSet.has(normalizedId);
    markPending(normalizedId, true);
    try {
      await toggleFavorite(normalizedId);
      pushAlert(
        alreadyFavorite
          ? `Jogo "${gameName}" removido dos favoritos.`
          : `Jogo "${gameName}" adicionado aos favoritos.`,
        'success',
      );
    } catch (error) {
      pushAlert(error.message ?? 'Erro ao atualizar favoritos.', 'danger');
    } finally {
      markPending(normalizedId, false);
    }
  }, [favoritesSet, markPending, pushAlert, requireAuth, toggleFavorite]);

  const gamesContent = games.length ? (
    <div id="gamesContainer" className="row row-cols-1 row-cols-md-2 g-4">
      {games.map((game) => (
        <GameCard
          key={game.appId}
          game={game}
          onRemove={handleRemoveGame}
          onShowComments={handleShowComments}
          onToggleFavorite={handleToggleFavorite}
          isFavorite={favoritesSet.has(game.appId)}
          favoriteDisabled={favoritePending.has(game.appId)}
        />
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <i className="bi bi-controller" />
      <p className="mt-3">Busque um jogo pelo nome ou AppID para começar.</p>
    </div>
  );

  return (
    <>
      <AlertStack alerts={alerts} onDismiss={dismissAlert} />

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Buscar Jogo da Steam</h5>
          <div className="row g-3">
            <div className="col-md-8">
              <div className="search-wrapper" ref={searchWrapperRef}>
                <input
                  type="text"
                  id="appIdInput"
                  className="form-control"
                  placeholder="Digite o nome ou AppID do jogo (ex: Counter-Strike, 730)"
                  value={searchTerm}
                  onFocus={() => setSearchVisible(searchResults.length > 0)}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddGame();
                    }
                  }}
                />
                <SearchResultsDropdown
                  visible={searchVisible}
                  loading={searchLoading}
                  results={searchResults}
                  onSelect={(game) => {
                    setSelectedAppId(game.appid.toString());
                    setSearchTerm(game.name);
                    setSearchVisible(false);
                  }}
                />
              </div>
            </div>
            <div className="col-md-4">
              <button type="button" className="btn btn-primary w-100" onClick={() => handleAddGame()}>
                <i className="bi bi-search" /> Buscar Jogo
              </button>
            </div>
          </div>
          <div className="mt-2">
            <small className="text-muted">💡 Digite o nome do jogo ou AppID. Exemplos: "Counter-Strike", "Dota", ou "730"</small>
          </div>
        </div>
      </div>

      <div className="card shadow-sm mb-4 border-info">
        <div className="card-body">
          <h5 className="card-title mb-3">
            <i className="bi bi-chat-square-text text-info" /> Buscar por Palavras-Chave nos Comentários
          </h5>
          <div className="row g-3">
            <div className="col-md-8">
              <input
                type="text"
                id="keywordsInput"
                className="form-control"
                placeholder="Digite palavras-chave separadas por vírgula (ex: ação, terror, top, bonzao)"
                value={keywordInput}
                onChange={(event) => setKeywordInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleKeywordSearch();
                  }
                }}
              />
            </div>
            <div className="col-md-4">
              <button type="button" className="btn btn-info w-100 text-white" onClick={handleKeywordSearch}>
                <i className="bi bi-search" /> Buscar por Comentários
              </button>
            </div>
          </div>
          <div className="mt-2">
            <small className="text-muted">
              💡 Busca jogos cujos comentários contêm as palavras-chave. Ex: "ação, terror, suspense"
            </small>
          </div>
        </div>
      </div>

      {user ? (
            <div className="card shadow-sm mb-4 border-warning">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h5 className="card-title mb-1">Meus favoritos</h5>
                    <p className="text-muted mb-0">Acesse rapidamente os jogos salvos.</p>
                  </div>
                  <span className="badge bg-warning text-dark">{favorites.length} jogos</span>
                </div>
                {favorites.length ? (
                  <div className="favorites-preview">
                    {favorites.slice(0, 4).map((fav) => (
                      <div key={fav.app_id} className="favorite-preview-card">
                        <p className="fw-semibold">{fav.name ?? `App ${fav.app_id}`}</p>
                        <small>
                          {formatNumber(fav.total_reviews ?? 0)} reviews · {fav.review_score_desc ?? 'N/A'}
                        </small>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger mt-2"
                          onClick={() => handleToggleFavorite(fav.app_id, fav.name ?? fav.app_id)}
                          disabled={favoritePending.has(fav.app_id?.toString())}
                        >
                          <i className="bi bi-trash" /> Remover
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted mb-0">Use o botão de estrela nos cards para salvar seus jogos favoritos.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="card shadow-sm mb-4 border border-warning-subtle">
              <div className="card-body d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                <div>
                  <h5 className="card-title mb-1">Crie sua lista de favoritos</h5>
                  <p className="text-muted mb-0">Cadastre-se para salvar jogos e acessá-los em qualquer sessão.</p>
                </div>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary" onClick={() => openAuthDialog('login')}>
                    Entrar
                  </button>
                  <button type="button" className="btn btn-warning" onClick={() => openAuthDialog('register')}>
                    Criar conta
                  </button>
                </div>
              </div>
            </div>
          )}

      <KeywordResults
        state={keywordState}
        onAddGame={handleAddGame}
        onShowComments={handleShowComments}
        onShowKeywordComments={handleShowKeywordComments}
      />

      {globalLoading ? (
        <div id="loadingArea" className="text-center mb-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Carregando...</span>
          </div>
          <p className="mt-2">Buscando informações do jogo...</p>
        </div>
      ) : null}

      {gamesContent}

      <CommentsModal
        state={modalState}
        onClose={() => setModalState(initialModalState)}
        onLoadMore={() => {
          if (modalState.appId && modalState.cursor) {
            fetchComments(modalState.appId, modalState.cursor, true);
          }
        }}
      />
    </>
  );
};

export default Home;
