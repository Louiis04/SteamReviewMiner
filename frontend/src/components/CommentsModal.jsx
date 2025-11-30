import { createPortal } from 'react-dom';
import { useEffect, useMemo } from 'react';
import { escapeRegExp, formatNumber } from '../utils/formatters.js';

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

export default CommentsModal;
