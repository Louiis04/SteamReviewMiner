let games = {};
let currentModalAppId = null;
let currentCursor = '*';

const API_BASE_URL = 'http://localhost:3000/api';

async function addGame() {
    const appIdInput = document.getElementById('appIdInput');
    const appId = appIdInput.value.trim();

    if (!appId || isNaN(appId)) {
        showAlert('Por favor, digite um AppID válido!', 'warning');
        return;
    }

    if (games[appId]) {
        showAlert('Este jogo já foi adicionado!', 'info');
        appIdInput.value = '';
        return;
    }

    showLoading(true);

    try {
        const reviewsResponse = await fetch(`${API_BASE_URL}/game/reviews/${appId}?num_per_page=0`);
        const reviewsData = await reviewsResponse.json();

        if (!reviewsData.success) {
            throw new Error('Jogo não encontrado ou sem avaliações');
        }

        const detailsResponse = await fetch(`${API_BASE_URL}/game/details/${appId}`);
        const detailsData = await detailsResponse.json();

        let gameName = `Jogo ${appId}`;
        if (detailsData[appId] && detailsData[appId].success) {
            gameName = detailsData[appId].data.name;
        }

        games[appId] = {
            appId: appId,
            name: gameName,
            reviewsData: reviewsData.query_summary
        };

        renderGameCard(appId);
        
        appIdInput.value = '';
        showAlert(`Jogo "${gameName}" adicionado com sucesso!`, 'success');

    } catch (error) {
        console.error('Erro ao buscar jogo:', error);
        showAlert('Erro ao buscar informações do jogo. Verifique o AppID.', 'danger');
    } finally {
        showLoading(false);
    }
}

function renderGameCard(appId) {
    const game = games[appId];
    const container = document.getElementById('gamesContainer');

    const totalReviews = game.reviewsData.total_reviews;
    const totalPositive = game.reviewsData.total_positive;
    const percentage = totalReviews > 0 ? ((totalPositive / totalReviews) * 100).toFixed(1) : 0;

    const cardHTML = `
        <div class="col" id="game-${appId}">
            <div class="card game-card shadow">
                <button class="btn btn-danger btn-sm btn-remove-game" onclick="removeGame('${appId}')">
                    <i class="bi bi-x-lg"></i>
                </button>
                <div class="card-body">
                    <!-- Miniatura do jogo -->
                    <div class="text-center mb-3">
                        <img 
                            src="https://cdn.akamai.steamstatic.com/steam/apps/${appId}/capsule_184x69.jpg" 
                            alt="${game.name}"
                            class="game-thumbnail"
                            onerror="this.src='https://via.placeholder.com/184x69?text=Sem+Imagem'">
                    </div>

                    <h5 class="card-title text-center mb-3">${game.name}</h5>

                    <!-- Estatísticas de avaliação -->
                    <div class="review-stats mb-3">
                        <div class="review-percentage">${percentage}%</div>
                        <div>
                            <span class="review-badge">${game.reviewsData.review_score_desc || 'N/A'}</span>
                        </div>
                    </div>

                    <div class="game-info-section">
                        <div class="stat-item">
                            <span class="stat-label">Total de Avaliações:</span>
                            <span class="stat-value">${formatNumber(totalReviews)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Avaliações Positivas:</span>
                            <span class="stat-value text-success">${formatNumber(totalPositive)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Avaliações Negativas:</span>
                            <span class="stat-value text-danger">${formatNumber(game.reviewsData.total_negative)}</span>
                        </div>
                    </div>

                    <button 
                        class="btn btn-primary w-100 mt-3" 
                        onclick="showComments('${appId}')">
                        <i class="bi bi-chat-left-text"></i> Ver Comentários
                    </button>
                </div>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', cardHTML);
}

function removeGame(appId) {
    if (confirm('Deseja remover este jogo?')) {
        delete games[appId];
        const gameElement = document.getElementById(`game-${appId}`);
        if (gameElement) {
            gameElement.remove();
        }
    }
}

async function showComments(appId) {
    currentModalAppId = appId;
    currentCursor = '*';
    
    const game = games[appId];
    document.getElementById('modalGameTitle').textContent = `Comentários - ${game.name}`;
    document.getElementById('modalCommentsBody').innerHTML = '<div class="loading-spinner"><div class="spinner-border text-primary"></div></div>';
    
    const modal = new bootstrap.Modal(document.getElementById('commentsModal'));
    modal.show();

    await loadComments(appId);
}

async function loadComments(appId, cursor = '*') {
    try {
        const response = await fetch(`${API_BASE_URL}/game/comments/${appId}?num_per_page=10&cursor=${cursor}`);
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
    if (show) {
        loadingArea.classList.remove('d-none');
    } else {
        loadingArea.classList.add('d-none');
    }
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
    }, 5000);
}

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Steam Review App carregada!');
});
