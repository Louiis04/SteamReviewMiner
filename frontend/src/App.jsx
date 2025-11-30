import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

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

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const formatNumber = (value = 0) => new Intl.NumberFormat('pt-BR').format(value || 0);

const renderHighlightedText = (text, keywords) => {
  if (!text) {
    return 'Sem texto de comentário.';
  }

  const sanitized = keywords?.filter((k) => k.trim().length > 0) ?? [];
  if (!sanitized.length) {
    return text;
  }

  const regex = new RegExp(`(${sanitized.map((k) => escapeRegExp(k)).join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    const isMatch = sanitized.some((keyword) => keyword.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark key={`kw-${part}-${index}`} className="keyword-highlight">
          {part}
        </mark>
      );
    }
    return <span key={`txt-${part}-${index}`}>{part}</span>;
  });
};

const CommentCard = ({ review, keywords }) => {
  const createdAt = useMemo(() => {
    if (!review.timestamp_created) return 'Data desconhecida';
    return new Date(review.timestamp_created * 1000).toLocaleDateString('pt-BR');
  }, [review.timestamp_created]);

  const voteClass = review.voted_up ? 'text-success' : 'text-danger';
  const voteIcon = review.voted_up ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-down-fill';

  return (
    <div className={`comment-card card p-3 ${keywords?.length ? 'keyword-comment-card' : ''}`}>
      <div className="comment-header">
        <span className="comment-author">
          <i className="bi bi-person-circle" /> {review.author?.steamid ?? 'Usuário Steam'}
        </span>
        <span className="comment-date">{createdAt}</span>
      </div>
      <div className={`${voteClass} mb-2`}>
        <i className={`bi ${voteIcon}`} /> <strong>{review.voted_up ? 'Positiva' : 'Negativa'}</strong>
      </div>
      <div className="comment-text">{renderHighlightedText(review.review, keywords)}</div>
      <div className="comment-stats">
        <div className="vote-indicator vote-up">
          <i className="bi bi-hand-thumbs-up" />
          <span>{formatNumber(review.votes_up || 0)} úteis</span>
        </div>
        <div className="vote-indicator vote-down">
          <i className="bi bi-hand-thumbs-down" />
          <span>{formatNumber(review.votes_down || 0)}</span>
        </div>
        {review.author?.playtime_forever ? (
          <div className="text-muted">
            <i className="bi bi-clock" /> {(review.author.playtime_forever / 60).toFixed(1)}h jogadas
          </div>
        ) : null}
        {review.comment_relevance ? (
          <div className="text-info">
            <i className="bi bi-star-fill" /> Relevância: {review.comment_relevance}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const CommentsModal = ({ state, onClose, onLoadMore }) => {
  useEffect(() => {
    if (!state.open) return undefined;
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [state.open]);

  if (!state.open) {
    return null;
  }

  return createPortal(
    <>
      <div className="modal fade show" style={{ display: 'block' }} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{state.title}</h5>
              <button type="button" className="btn-close" onClick={onClose} aria-label="Fechar" />
            </div>
            <div className="modal-body">
              {state.loading && state.comments.length === 0 ? (
                <div className="loading-spinner">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : null}

              {!state.loading && state.comments.length === 0 ? (
                <div className="text-center text-muted py-4">
                  <i className="bi bi-chat-left" style={{ fontSize: '3rem' }} />
                  <p className="mt-2">Nenhum comentário encontrado.</p>
                </div>
              ) : null}

              {state.comments.map((review) => (
                <CommentCard key={review.recommendationid} review={review} keywords={state.keywords} />
              ))}

              {state.loading && state.comments.length > 0 ? (
                <div className="loading-spinner">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              ) : null}
            </div>
            <div className="modal-footer">
              {!state.keywordsMode ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!state.cursor || state.loading}
                  onClick={onLoadMore}
                >
                  <i className="bi bi-arrow-down-circle" /> Carregar Mais
                </button>
              ) : null}
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop fade show" />
    </>,
    document.body,
  );
};

const GameCard = ({ game, onRemove, onShowComments }) => {
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
                      <i className="bi bi-chat-dots-fill" />{' '}
                      {game.comment_matches ?? 0}{' '}
                      {(game.comment_matches ?? 0) === 1 ? 'comentário encontrado' : 'comentários encontrados'}
                    </small>
                    <br />
                    <small className="text-muted">
                      <i className="bi bi-star-fill" /> Score de relevância: {Math.round(game.relevance_score ?? 0)}
                    </small>
                  </div>
                  {game.short_description ? (
                    <p className="card-text small text-muted">
                      {`${game.short_description.substring(0, 120)}...`}
                    </p>
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
        <button
          type="button"
          key={game.appid}
          className="search-result-item w-100 text-start"
          onClick={() => onSelect(game)}
        >
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

const AlertStack = ({ alerts, onDismiss }) => (
  <div className="alert-stack">
    {alerts.map((alert) => (
      <div key={alert.id} className={`alert alert-${alert.variant} alert-dismissible fade show`} role="alert">
        {alert.message}
        <button type="button" className="btn-close" aria-label="Fechar" onClick={() => onDismiss(alert.id)} />
      </div>
    ))}
  </div>
);

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchController = useRef();
  const searchCache = useRef(new Map());
  const searchWrapperRef = useRef(null);

  const [games, setGames] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const alertTimeouts = useRef({});

  const [keywordInput, setKeywordInput] = useState('');
  const [keywordState, setKeywordState] = useState({ visible: false, loading: false, games: [], total: 0, message: '' });
  const [currentKeywordList, setCurrentKeywordList] = useState([]);

  const [modalState, setModalState] = useState(initialModalState);

  const pushAlert = useCallback((message, variant = 'info') => {
    const id = crypto.randomUUID ? crypto.randomUUID() : `alert-${Date.now()}-${Math.random()}`;
    setAlerts((prev) => [...prev, { id, message, variant }]);
    const timeoutId = setTimeout(() => {
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    }, 5000);
    alertTimeouts.current[id] = timeoutId;
  }, []);

  const dismissAlert = useCallback((id) => {
    if (alertTimeouts.current[id]) {
      clearTimeout(alertTimeouts.current[id]);
      delete alertTimeouts.current[id];
    }
    setAlerts((prev) => prev.filter((alert) => alert.id !== id));
  }, []);

  useEffect(() => () => {
    Object.values(alertTimeouts.current).forEach((timeoutId) => clearTimeout(timeoutId));
  }, []);

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

  const handleAddGame = useCallback(
    async (appIdFromButton) => {
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
    },
    [fetchGameData, games, pushAlert, searchTerm, selectedAppId],
  );

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

  const gamesContent = games.length ? (
    <div id="gamesContainer" className="row row-cols-1 row-cols-md-2 g-4">
      {games.map((game) => (
        <GameCard key={game.appId} game={game} onRemove={handleRemoveGame} onShowComments={handleShowComments} />
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <i className="bi bi-controller" />
      <p className="mt-3">Busque um jogo pelo nome ou AppID para começar.</p>
    </div>
  );

  return (
    <div className="app-bg">
      <nav className="navbar navbar-dark bg-dark mb-4">
        <div className="container">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-steam" /> Steam Game Reviews
          </span>
          <button type="button" className="btn btn-outline-light btn-sm" disabled>
            <i className="bi bi-trophy" /> Top Jogos (em breve)
          </button>
        </div>
      </nav>

      <div className="container">
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
      </div>

      <CommentsModal
        state={modalState}
        onClose={() => setModalState(initialModalState)}
        onLoadMore={() => {
          if (modalState.appId && modalState.cursor) {
            fetchComments(modalState.appId, modalState.cursor, true);
          }
        }}
      />
    </div>
  );
}

export default App;
