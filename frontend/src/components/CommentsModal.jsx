import { createPortal } from 'react-dom';
import { useEffect, useMemo } from 'react';
import { escapeRegExp, formatNumber } from '../utils/formatters.js';

const LANGUAGE_LABELS = {
  all: 'Todos os idiomas',
  english: 'Inglês',
  brazilian: 'Português (Brasil)',
  portuguese: 'Português',
  spanish: 'Espanhol',
  latam: 'Espanhol (LATAM)',
  french: 'Francês',
  german: 'Alemão',
  italian: 'Italiano',
  schinese: 'Chinês (Simplificado)',
  tchinese: 'Chinês (Tradicional)',
  japanese: 'Japonês',
  korean: 'Coreano',
  russian: 'Russo',
  polish: 'Polonês',
  turkish: 'Turco',
  ukrainian: 'Ucraniano',
  arabic: 'Árabe',
  romanian: 'Romeno',
  hungarian: 'Húngaro',
  czech: 'Tcheco',
  thai: 'Tailandês',
  vietnamese: 'Vietnamita',
  unknown: 'Idioma não informado',
};

const getLanguageLabel = (code) => {
  if (!code) {
    return LANGUAGE_LABELS.unknown;
  }
  const normalized = code.toLowerCase();
  if (LANGUAGE_LABELS[normalized]) {
    return LANGUAGE_LABELS[normalized];
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const renderHighlightedText = (text, keywords) => {
  if (!text) {
    return 'Sem texto de comentário.';
  }

  const sanitized = keywords?.filter((keyword) => keyword.trim().length > 0) ?? [];
  if (!sanitized.length) {
    return text;
  }

  const regex = new RegExp(`(${sanitized.map((keyword) => escapeRegExp(keyword)).join('|')})`, 'gi');
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

const CommentsModal = ({ state, onClose, onLoadMore, onChangeLanguage }) => {
  const languageOptions = useMemo(() => {
    if (state.keywordsMode) {
      return [];
    }

    const counts = new Map();
    const addCount = (language, totalValue = 0) => {
      const normalized = (language || 'unknown').toLowerCase();
      const totalAsNumber = Number.isFinite(totalValue) ? totalValue : parseInt(totalValue, 10) || 0;
      counts.set(normalized, (counts.get(normalized) ?? 0) + totalAsNumber);
    };

    if (Array.isArray(state.availableLanguages) && state.availableLanguages.length > 0) {
      state.availableLanguages.forEach(({ language, total }) => addCount(language, total));
    } else if (Array.isArray(state.comments) && state.comments.length > 0) {
      state.comments.forEach((comment) => addCount(comment.language, 1));
    }

    const options = Array.from(counts.entries())
      .filter(([code]) => code && code !== 'all')
      .map(([code, total]) => ({ code, total }))
      .sort((a, b) => b.total - a.total);

    const selected = (state.language || 'all').toLowerCase();
    if (selected !== 'all' && !options.some((option) => option.code === selected)) {
      options.push({ code: selected, total: 0 });
    }

    return options;
  }, [state.availableLanguages, state.comments, state.keywordsMode, state.language]);

  const showLanguageFilter = !state.keywordsMode && languageOptions.length > 0;
  const totalLanguageCount = useMemo(
    () => languageOptions.reduce((sum, option) => sum + (Number(option.total) || 0), 0),
    [languageOptions],
  );

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
              {showLanguageFilter ? (
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
                  <div className="text-muted small d-flex align-items-center gap-2">
                    <i className="bi bi-translate" /> Filtrar idioma
                  </div>
                  <select
                    className="form-select form-select-sm w-100 w-md-auto"
                    value={state.language ?? 'all'}
                    onChange={(event) => onChangeLanguage?.(event.target.value)}
                    disabled={state.loading}
                  >
                    <option value="all">
                      {LANGUAGE_LABELS.all}
                      {totalLanguageCount ? ` (${formatNumber(totalLanguageCount)})` : ''}
                    </option>
                    {languageOptions.map((option) => (
                      <option key={option.code} value={option.code}>
                        {getLanguageLabel(option.code)}
                        {option.total ? ` (${formatNumber(option.total)})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
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

export default CommentsModal;
