const API_BASE_URL = 'http://localhost:3000/api';
let currentModalAppId = null;
let currentCursor = '*';
let allGames = [];
let currentPage = 1;
const GAMES_PER_PAGE = 10;

document.addEventListener('DOMContentLoaded', () => {
    loadTopGames();
});

async function loadTopGames() {
    const sortBy = document.getElementById('sortSelect').value;
    const minReviews = document.getElementById('minReviewsSelect').value;
    const limit = document.getElementById('limitSelect').value;

    showLoading(true);
    hideEmptyState();
    hideStatsArea();
    hidePagination();
    document.getElementById('gamesGrid').innerHTML = '';
    currentPage = 1;

    try {
        const fetchLimit = limit === 'all' ? 10000 : limit;
        const response = await fetch(
            `${API_BASE_URL}/top-games?sort=${sortBy}&min_reviews=${minReviews}&limit=${fetchLimit}`
        );
        const data = await response.json();

        if (data.success && data.games && data.games.length > 0) {
            allGames = data.games;
            
            if (limit === 'all') {
                displayPaginatedGames();
                showPagination();
                showStatsArea(data.games.length);
            } else {
                displayGames(data.games);
                showStatsArea(data.games.length);
            }
        } else {
            showEmptyState();
        }
    } catch (error) {
        showAlert('Erro ao carregar jogos. Verifique se o servidor está rodando e se há dados no banco.', 'danger');
        showEmptyState();
    } finally {
        showLoading(false);
    }
}

function displayPaginatedGames() {
    const startIndex = (currentPage - 1) * GAMES_PER_PAGE;
    const endIndex = startIndex + GAMES_PER_PAGE;
    const gamesToShow = allGames.slice(startIndex, endIndex);
    
    displayGames(gamesToShow, startIndex);
    updatePagination();
}

function goToPage(page) {
    currentPage = page;
    displayPaginatedGames();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updatePagination() {
    const totalPages = Math.ceil(allGames.length / GAMES_PER_PAGE);
    const paginationList = document.getElementById('paginationList');
    paginationList.innerHTML = '';

    const maxVisiblePages = 7;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Botão Anterior
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" onclick="goToPage(${currentPage - 1}); return false;">
            <i class="bi bi-chevron-left"></i> Anterior
        </a>
    `;
    paginationList.appendChild(prevLi);

    // Primeira página
    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        firstLi.innerHTML = `<a class="page-link" href="#" onclick="goToPage(1); return false;">1</a>`;
        paginationList.appendChild(firstLi);

        if (startPage > 2) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            dotsLi.innerHTML = `<span class="page-link">...</span>`;
            paginationList.appendChild(dotsLi);
        }
    }

    // Páginas visíveis
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" onclick="goToPage(${i}); return false;">${i}</a>`;
        paginationList.appendChild(li);
    }

    // Última página
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const dotsLi = document.createElement('li');
            dotsLi.className = 'page-item disabled';
            dotsLi.innerHTML = `<span class="page-link">...</span>`;
            paginationList.appendChild(dotsLi);
        }

        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        lastLi.innerHTML = `<a class="page-link" href="#" onclick="goToPage(${totalPages}); return false;">${totalPages}</a>`;
        paginationList.appendChild(lastLi);
    }

    // Botão Próximo
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" onclick="goToPage(${currentPage + 1}); return false;">
            Próximo <i class="bi bi-chevron-right"></i>
        </a>
    `;
    paginationList.appendChild(nextLi);
}

function displayGames(games, startIndex = 0) {
    const grid = document.getElementById('gamesGrid');
    grid.innerHTML = '';

    games.forEach((game, index) => {
        const rank = startIndex + index + 1;
        const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
        
        const percentage = parseFloat(game.positive_percentage) || 0;
        const ratingClass = percentage >= 90 ? 'excellent' : percentage >= 75 ? 'good' : 'average';

        const card = document.createElement('div');
        card.className = 'col';
        card.innerHTML = `
            <div class="card game-card shadow">
                <div class="card-body p-3">
                    <div class="game-rank ${rankClass}">${rank}</div>
                    
                    <div class="position-relative mb-3">
                        <img 
                            src="${game.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`}" 
                            alt="${escapeHtml(game.name)}"
                            class="game-thumbnail"
                            onerror="this.src='https://via.placeholder.com/460x215?text=Sem+Imagem'">
                        <div class="rating-badge ${ratingClass}">
                            ${percentage}%
                        </div>
                    </div>

                    <h5 class="game-title">${escapeHtml(game.name)}</h5>
                    
                    ${game.short_description ? `
                        <p class="game-description">${escapeHtml(game.short_description)}</p>
                    ` : ''}

                    <div class="game-stats">
                        <div class="stat-row">
                            <span class="stat-label">
                                <i class="bi bi-star-fill text-warning"></i>
                                Avaliação:
                            </span>
                            <span class="stat-value">${game.review_score_desc || 'N/A'}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">
                                <i class="bi bi-chat-square-text"></i>
                                Total:
                            </span>
                            <span class="stat-value">${formatNumber(game.total_reviews)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">
                                <i class="bi bi-hand-thumbs-up-fill text-success"></i>
                                Positivas:
                            </span>
                            <span class="stat-value text-success">${formatNumber(game.total_positive)}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">
                                <i class="bi bi-hand-thumbs-down-fill text-danger"></i>
                                Negativas:
                            </span>
                            <span class="stat-value text-danger">${formatNumber(game.total_negative)}</span>
                        </div>
                    </div>

                    <div class="progress mb-3">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${percentage}%">
                            ${percentage}% Positivas
                        </div>
                    </div>

                    ${game.developers ? `
                        <p class="text-muted small mb-2">
                            <i class="bi bi-code-square"></i> ${escapeHtml(game.developers)}
                        </p>
                    ` : ''}

                    <div class="game-footer">
                        <button 
                            class="btn btn-primary btn-view-comments" 
                            onclick="showComments('${game.app_id}', '${escapeHtml(game.name)}')">
                            <i class="bi bi-chat-left-text"></i> Ver Comentários
                        </button>
                        <a 
                            href="https://store.steampowered.com/app/${game.app_id}" 
                            target="_blank"
                            class="btn btn-dark btn-steam-link"
                            title="Ver na Steam">
                            <i class="bi bi-steam"></i>
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
    });
}

async function triggerPreload() {
    const btn = document.getElementById('preloadBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Iniciando...';
    }
    try {
        const response = await fetch(`${API_BASE_URL}/preload?limit=100`);
        const data = await response.json();
        if (data.success) {
            showAlert(`Pré-carregamento iniciado: ${data.total} jogos em processamento. Aguarde alguns minutos e clique em "Atualizar Lista".`, 'success');
        } else {
            showAlert('Erro ao iniciar pré-carregamento.', 'danger');
        }
    } catch (err) {
        showAlert('Erro ao iniciar pré-carregamento.', 'danger');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-download"></i> Iniciar Pré-carregamento de 100 Jogos';
        }
    }
}

async function showComments(appId, gameName) {
    currentModalAppId = appId;
    currentCursor = '*';
    
    document.getElementById('modalGameTitle').textContent = `Comentários - ${gameName}`;
    document.getElementById('modalCommentsBody').innerHTML = 
        '<div class="loading-spinner"><div class="spinner-border text-primary"></div></div>';
    
    const modal = new bootstrap.Modal(document.getElementById('commentsModal'));
    modal.show();

    await loadComments(appId);
}

async function loadComments(appId, cursor = '*') {
    try {
        const response = await fetch(
            `${API_BASE_URL}/game/comments/${appId}?num_per_page=10&cursor=${cursor}`
        );
        const data = await response.json();

        if (!data.success || !data.reviews || data.reviews.length === 0) {
            if (cursor === '*') {
                document.getElementById('modalCommentsBody').innerHTML = `
                    <div class="text-center text-muted py-4">
                        <i class="bi bi-chat-left" style="font-size: 3rem;"></i>
                        <p class="mt-2">Nenhum comentário encontrado.</p>
                    </div>
                `;
            }
            document.getElementById('loadMoreBtn').disabled = true;
            return;
        }

        currentCursor = data.cursor;

        const commentsHTML = data.reviews.map(review => renderComment(review)).join('');
        
        if (cursor === '*') {
            document.getElementById('modalCommentsBody').innerHTML = commentsHTML;
        } else {
            document.getElementById('modalCommentsBody').insertAdjacentHTML('beforeend', commentsHTML);
        }

        document.getElementById('loadMoreBtn').disabled = !data.cursor || data.cursor === '';

    } catch (error) {
        console.error('Erro ao carregar comentários:', error);
        document.getElementById('modalCommentsBody').innerHTML = `
            <div class="alert alert-danger">
                Erro ao carregar comentários. Tente novamente.
            </div>
        `;
    }
}

function renderComment(review) {
    const date = new Date(review.timestamp_created * 1000).toLocaleDateString('pt-BR');
    const votesUp = review.votes_up || 0;
    const votesDown = review.votes_down || 0;
    const votedUp = review.voted_up ? 'Positiva' : 'Negativa';
    const voteClass = review.voted_up ? 'text-success' : 'text-danger';
    const voteIcon = review.voted_up ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-down-fill';

    return `
        <div class="comment-card card p-3">
            <div class="comment-header">
                <span class="comment-author">
                    <i class="bi bi-person-circle"></i> ${review.author?.steamid || 'Usuário Steam'}
                </span>
                <span class="comment-date">${date}</span>
            </div>
            <div class="${voteClass} mb-2">
                <i class="${voteIcon}"></i> <strong>${votedUp}</strong>
            </div>
            <div class="comment-text">
                ${escapeHtml(review.review) || 'Sem texto de comentário.'}
            </div>
            <div class="comment-stats">
                <div class="vote-indicator vote-up">
                    <i class="bi bi-hand-thumbs-up"></i>
                    <span>${formatNumber(votesUp)} úteis</span>
                </div>
                <div class="vote-indicator vote-down">
                    <i class="bi bi-hand-thumbs-down"></i>
                    <span>${formatNumber(votesDown)}</span>
                </div>
                ${review.author?.playtime_forever ? 
                    `<div class="text-muted">
                        <i class="bi bi-clock"></i> ${(review.author.playtime_forever / 60).toFixed(1)}h jogadas
                    </div>` : ''}
            </div>
        </div>
    `;
}

function loadMoreComments() {
    if (currentModalAppId && currentCursor) {
        loadComments(currentModalAppId, currentCursor);
    }
}

function showLoading(show) {
    const loadingArea = document.getElementById('loadingArea');
    const gamesGrid = document.getElementById('gamesGrid');
    
    if (show) {
        loadingArea.classList.remove('d-none');
        gamesGrid.classList.add('d-none');
    } else {
        loadingArea.classList.add('d-none');
        gamesGrid.classList.remove('d-none');
    }
}

function showEmptyState() {
    document.getElementById('emptyState').classList.remove('d-none');
    document.getElementById('gamesGrid').classList.add('d-none');
}

function hideEmptyState() {
    document.getElementById('emptyState').classList.add('d-none');
}

function showStatsArea(total) {
    document.getElementById('totalGames').textContent = total;
    document.getElementById('statsArea').classList.remove('d-none');
}

function hideStatsArea() {
    document.getElementById('statsArea').classList.add('d-none');
}

function showPagination() {
    document.getElementById('paginationArea').classList.remove('d-none');
}

function hidePagination() {
    document.getElementById('paginationArea').classList.add('d-none');
}

function showAlert(message, type) {
    const alertHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    const container = document.querySelector('.container');
    container.insertAdjacentHTML('afterbegin', alertHTML);

    setTimeout(() => {
        const alert = container.querySelector('.alert');
        if (alert) {
            alert.remove();
        }
    }, 10000);
}

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
