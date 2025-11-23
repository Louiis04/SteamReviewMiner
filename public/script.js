let games = {};
let currentModalAppId = null;
let currentCursor = '*';
let searchTimeout = null;
let searchCache = {};
let selectedAppId = null;

const API_BASE_URL = 'http://localhost:3000/api';


async function handleSearchInput() {
    const input = document.getElementById('appIdInput');
    const searchTerm = input.value.trim();
    const resultsDiv = document.getElementById('searchResults');

    selectedAppId = null;

    if (searchTerm.length < 2) {
        resultsDiv.classList.add('d-none');
        return;
    }

    if (/^\d+$/.test(searchTerm)) {
        resultsDiv.classList.add('d-none');
        return;
    }

    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }

    searchTimeout = setTimeout(async () => {
        await searchGames(searchTerm);
    }, 300);
}

async function searchGames(searchTerm) {
    const resultsDiv = document.getElementById('searchResults');

    if (searchCache[searchTerm.toLowerCase()]) {
        displaySearchResults(searchCache[searchTerm.toLowerCase()]);
        return;
    }

    resultsDiv.innerHTML = `
        <div class="search-loading">
            <div class="spinner-border spinner-border-sm text-primary"></div>
            <span class="ms-2">Buscando...</span>
        </div>
    `;
    resultsDiv.classList.remove('d-none');

    try {
        const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchTerm)}`);
        const data = await response.json();

        if (data.success && data.games && data.games.length > 0) {
            searchCache[searchTerm.toLowerCase()] = data.games;
            displaySearchResults(data.games);
        } else {
            resultsDiv.innerHTML = `
                <div class="search-no-results">
                    <i class="bi bi-search"></i> Nenhum jogo encontrado
                </div>
            `;
        }
    } catch (error) {
        console.error('Erro ao buscar jogos:', error);
        resultsDiv.innerHTML = `
            <div class="search-no-results text-danger">
                <i class="bi bi-exclamation-triangle"></i> Erro ao buscar
            </div>
        `;
    }
}

function displaySearchResults(games) {
    const resultsDiv = document.getElementById('searchResults');
    
    if (!games || games.length === 0) {
        resultsDiv.innerHTML = `
            <div class="search-no-results">
                <i class="bi bi-search"></i> Nenhum jogo encontrado
            </div>
        `;
        resultsDiv.classList.remove('d-none');
        return;
    }

    const resultsHTML = games.map(game => `
        <div class="search-result-item" onclick="selectGame('${game.appid}', '${escapeHtml(game.name)}')">
            <img 
                src="${game.header_image}" 
                alt="${escapeHtml(game.name)}"
                class="search-result-thumbnail"
                onerror="this.src='https://via.placeholder.com/60x28?text=No+Image'">
            <div class="search-result-info">
                <div class="search-result-name">${escapeHtml(game.name)}</div>
                <div class="search-result-appid">AppID: ${game.appid}</div>
            </div>
        </div>
    `).join('');

    resultsDiv.innerHTML = resultsHTML;
    resultsDiv.classList.remove('d-none');
}

function selectGame(appId, gameName) {
    const input = document.getElementById('appIdInput');
    const resultsDiv = document.getElementById('searchResults');
    
    input.value = gameName;
    
    selectedAppId = appId;
    
    resultsDiv.classList.add('d-none');
    
    addGame();
}

function showSearchResults() {
    const input = document.getElementById('appIdInput');
    const resultsDiv = document.getElementById('searchResults');
    
    if (input.value.trim().length >= 2 && !resultsDiv.classList.contains('d-none')) {
        return;
    }
}

function hideSearchResults() {
    setTimeout(() => {
        document.getElementById('searchResults').classList.add('d-none');
    }, 200);
}

document.addEventListener('click', (e) => {
    const searchWrapper = document.querySelector('.search-wrapper');
    if (searchWrapper && !searchWrapper.contains(e.target)) {
        document.getElementById('searchResults').classList.add('d-none');
    }
});


async function addGame() {
    const appIdInput = document.getElementById('appIdInput');
    let appId = selectedAppId || appIdInput.value.trim();

    if (!/^\d+$/.test(appId)) {
        showAlert('Por favor, selecione um jogo da lista ou digite um AppID válido!', 'warning');
        return;
    }

    if (!appId) {
        showAlert('Por favor, digite o nome ou AppID de um jogo!', 'warning');
        return;
    }

    if (games[appId]) {
        showAlert('Este jogo já foi adicionado!', 'info');
        appIdInput.value = '';
        selectedAppId = null;
        return;
    }

    document.getElementById('searchResults').classList.add('d-none');

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
        selectedAppId = null;
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

function highlightKeywords(text, keywords) {
    if (!text || !keywords || keywords.length === 0) {
        return escapeHtml(text);
    }

    let highlightedText = escapeHtml(text);
    
    keywords.forEach(keyword => {
        if (keyword.length < 2) return;
        
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark class="keyword-highlight">$1</mark>');
    });

    return highlightedText;
}

let currentSearchKeywords = [];

async function searchByKeywords() {
    const keywordsInput = document.getElementById('keywordsInput');
    const keywords = keywordsInput.value.trim();

    if (!keywords || keywords.length < 2) {
        showAlert('Por favor, digite ao menos uma palavra-chave para buscar!', 'warning');
        return;
    }

    currentSearchKeywords = keywords.split(/[,;\s]+/).filter(k => k.length > 0);

    const resultsContainer = document.getElementById('keywordSearchResults');
    const gamesContainer = document.getElementById('keywordGamesContainer');
    const titleElement = document.getElementById('keywordSearchTitle');

    resultsContainer.classList.remove('d-none');
    gamesContainer.innerHTML = `
        <div class="col-12 text-center py-4">
            <div class="spinner-border text-info" role="status">
                <span class="visually-hidden">Buscando...</span>
            </div>
            <p class="mt-2 text-muted">Buscando jogos nos comentários...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE_URL}/search/keywords?keywords=${encodeURIComponent(keywords)}`);
        const data = await response.json();

        if (!data.success) {
            gamesContainer.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-exclamation-circle text-warning" style="font-size: 3rem;"></i>
                    <p class="mt-2">${data.message || 'Erro ao buscar jogos'}</p>
                </div>
            `;
            return;
        }

        if (!data.games || data.games.length === 0) {
            gamesContainer.innerHTML = `
                <div class="col-12 text-center py-4">
                    <i class="bi bi-search" style="font-size: 3rem; color: #999;"></i>
                    <p class="mt-2 text-muted">Nenhum jogo encontrado com essas palavras-chave nos comentários.</p>
                    <small class="text-muted">Tente palavras-chave diferentes ou mais gerais.</small>
                </div>
            `;
            return;
        }

        titleElement.textContent = `(${data.total} ${data.total === 1 ? 'jogo encontrado' : 'jogos encontrados'})`;

        const gamesHTML = data.games.map((game, index) => {
            const percentage = game.positive_percentage || 0;
            const totalReviews = game.total_reviews || 0;
            const commentMatches = game.comment_matches || 0;
            const relevanceScore = Math.round(game.relevance_score || 0);

            return `
                <div class="col">
                    <div class="card h-100 shadow-sm keyword-game-card">
                        <div class="position-relative">
                            <img 
                                src="${game.header_image || `https://cdn.akamai.steamstatic.com/steam/apps/${game.app_id}/header.jpg`}" 
                                class="card-img-top" 
                                alt="${escapeHtml(game.name)}"
                                onerror="this.src='https://via.placeholder.com/460x215?text=Sem+Imagem'">
                            <span class="badge bg-info position-absolute top-0 end-0 m-2">
                                #${index + 1}
                            </span>
                        </div>
                        <div class="card-body">
                            <h6 class="card-title">${escapeHtml(game.name)}</h6>
                            
                            <div class="mb-2">
                                <span class="badge bg-success me-1">${percentage}% Positivo</span>
                                <span class="badge bg-secondary">${formatNumber(totalReviews)} reviews</span>
                            </div>

                            <div class="keyword-match-info mb-2">
                                <small class="text-info">
                                    <i class="bi bi-chat-dots-fill"></i> 
                                    ${commentMatches} ${commentMatches === 1 ? 'comentário encontrado' : 'comentários encontrados'}
                                </small>
                                <br>
                                <small class="text-muted">
                                    <i class="bi bi-star-fill"></i> Score de relevância: ${relevanceScore}
                                </small>
                            </div>

                            ${game.short_description ? 
                                `<p class="card-text small text-muted">${escapeHtml(game.short_description).substring(0, 100)}...</p>` 
                                : ''}

                            <div class="d-grid gap-2">
                                <button class="btn btn-sm btn-primary" onclick="addGameFromSearch('${game.app_id}')">
                                    <i class="bi bi-plus-circle"></i> Adicionar à Lista
                                </button>
                                <button class="btn btn-sm btn-outline-secondary" onclick="showComments('${game.app_id}')">
                                    <i class="bi bi-chat-left-text"></i> Ver Todos os Comentários
                                </button>
                                <button class="btn btn-sm btn-outline-info" onclick="showKeywordComments('${game.app_id}', '${escapeHtml(game.name)}')">
                                    <i class="bi bi-search"></i> Ver Comentários Relevantes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        gamesContainer.innerHTML = gamesHTML;

    } catch (error) {
        console.error('Erro ao buscar por palavras-chave:', error);
        gamesContainer.innerHTML = `
            <div class="col-12 text-center py-4">
                <i class="bi bi-exclamation-triangle text-danger" style="font-size: 3rem;"></i>
                <p class="mt-2 text-danger">Erro ao buscar jogos. Tente novamente.</p>
            </div>
        `;
    }
}

async function addGameFromSearch(appId) {
    if (games[appId]) {
        showAlert('Este jogo já foi adicionado à lista!', 'info');
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
        
        showAlert(`Jogo "${gameName}" adicionado com sucesso!`, 'success');

        document.getElementById('gamesContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (error) {
        console.error('Erro ao adicionar jogo:', error);
        showAlert('Erro ao adicionar jogo à lista.', 'danger');
    } finally {
        showLoading(false);
    }
}

async function showKeywordComments(appId, gameName) {
    if (!currentSearchKeywords || currentSearchKeywords.length === 0) {
        showAlert('Nenhuma palavra-chave definida. Faça uma busca primeiro.', 'warning');
        return;
    }

    currentModalAppId = appId;
    
    document.getElementById('modalGameTitle').innerHTML = `
        Comentários Relevantes - ${gameName}
        <br><small class="text-muted">Palavras-chave: ${currentSearchKeywords.join(', ')}</small>
    `;
    document.getElementById('modalCommentsBody').innerHTML = '<div class="loading-spinner"><div class="spinner-border text-info"></div></div>';
    
    const modal = new bootstrap.Modal(document.getElementById('commentsModal'));
    modal.show();

    document.getElementById('loadMoreBtn').classList.add('d-none');

    try {
        const keywords = currentSearchKeywords.join(',');
        const response = await fetch(`${API_BASE_URL}/game/comments/keywords/${appId}?keywords=${encodeURIComponent(keywords)}&limit=20`);
        const data = await response.json();

        if (!data.success || !data.comments || data.comments.length === 0) {
            document.getElementById('modalCommentsBody').innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="bi bi-chat-left" style="font-size: 3rem;"></i>
                    <p class="mt-2">Nenhum comentário encontrado com essas palavras-chave.</p>
                </div>
            `;
            return;
        }

        const commentsHTML = data.comments.map(review => renderKeywordComment(review, currentSearchKeywords)).join('');
        document.getElementById('modalCommentsBody').innerHTML = commentsHTML;

    } catch (error) {
        console.error('Erro ao carregar comentários com palavras-chave:', error);
        document.getElementById('modalCommentsBody').innerHTML = `
            <div class="alert alert-danger">
                Erro ao carregar comentários. Tente novamente.
            </div>
        `;
    }
}

function renderKeywordComment(review, keywords) {
    const date = new Date(review.timestamp_created * 1000).toLocaleDateString('pt-BR');
    const votesUp = review.votes_up || 0;
    const votesDown = review.votes_down || 0;
    const votedUp = review.voted_up ? 'Positiva' : 'Negativa';
    const voteClass = review.voted_up ? 'text-success' : 'text-danger';
    const voteIcon = review.voted_up ? 'bi-hand-thumbs-up-fill' : 'bi-hand-thumbs-down-fill';
    
    const highlightedReview = highlightKeywords(review.review, keywords);

    return `
        <div class="comment-card card p-3 keyword-comment-card">
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
                ${highlightedReview || 'Sem texto de comentário.'}
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
                ${review.comment_relevance ? 
                    `<div class="text-info">
                        <i class="bi bi-star-fill"></i> Relevância: ${review.comment_relevance}
                    </div>` : ''}
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('Steam Review App carregada!');
});
