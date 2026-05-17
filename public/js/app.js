// public/js/app.js — общий клиентский JS для всех страниц

const CS2_ORIGINAL_FETCH = window.fetch.bind(window);
let CS2_STATIC_API_CACHE = null;

function cs2StaticApiUrl() {
    const base = window.CS2_ASSET_BASE || '.';
    return `${base}/data/api.json`;
}

async function cs2LoadStaticApi() {
    if (!CS2_STATIC_API_CACHE) {
        const response = await CS2_ORIGINAL_FETCH(cs2StaticApiUrl(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Static API ${response.status}`);
        CS2_STATIC_API_CACHE = await response.json();
    }
    return CS2_STATIC_API_CACHE;
}

function cs2JsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
}

function cs2ApiEndpoint(url) {
    const path = url.pathname.replace(/\/+$/, '');
    const apiIndex = path.indexOf('/api/');
    return apiIndex >= 0 ? path.slice(apiIndex + 4) : path;
}

function cs2FilterListings(listings, searchParams) {
    let items = listings.slice();
    const quality = searchParams.get('quality');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');
    const search = (searchParams.get('search') || '').trim().toLowerCase();
    const sort = searchParams.get('sort') || 'price_desc';

    if (quality && quality !== 'all') {
        items = items.filter(item => item.Quality === quality);
    }
    if (minPrice) {
        const min = Number(minPrice);
        items = items.filter(item => Number(item.Price) >= min);
    }
    if (maxPrice) {
        const max = Number(maxPrice);
        items = items.filter(item => Number(item.Price) <= max);
    }
    if (search) {
        items = items.filter(item =>
            String(item.SkinName || '').toLowerCase().includes(search) ||
            String(item.WeaponName || '').toLowerCase().includes(search)
        );
    }

    const sorters = {
        price_asc: (a, b) => Number(a.Price) - Number(b.Price),
        price_desc: (a, b) => Number(b.Price) - Number(a.Price),
        wear: (a, b) => Number(a.FloatValue || 0) - Number(b.FloatValue || 0),
        name: (a, b) => String(a.SkinName || '').localeCompare(String(b.SkinName || ''))
    };
    return items.sort(sorters[sort] || sorters.price_desc);
}

function cs2StaticPayload(data, endpoint, searchParams, init) {
    if (endpoint === '/stats') return data.stats;
    if (endpoint === '/top-listings') return data.topListings;
    if (endpoint === '/top-users') return data.topUsers;
    if (endpoint === '/categories') return data.categories;
    if (endpoint === '/quality-stats') return data.qualityStats;
    if (endpoint === '/sales-dynamics') return data.salesDynamics;
    if (endpoint === '/rich-users') return data.richUsers;
    if (endpoint === '/popular-skins') return data.popularSkins;
    if (endpoint === '/users-detail') return data.usersDetail;
    if (endpoint === '/listings') return cs2FilterListings(data.listings, searchParams);

    const balanceMatch = endpoint.match(/^\/user\/(\d+)\/balance$/);
    if (balanceMatch) {
        return data.usersDetail.find(user => String(user.UserID) === balanceMatch[1]) || data.currentUser;
    }

    const historyMatch = endpoint.match(/^\/user\/(\d+)\/purchase-history$/);
    if (historyMatch) {
        return data.purchaseHistory[String(historyMatch[1])] || [];
    }

    const buyMatch = endpoint.match(/^\/buy\/(\d+)$/);
    if (buyMatch && (!init || !init.method || String(init.method).toUpperCase() === 'POST')) {
        const listing = data.listings.find(item => String(item.ListingID) === buyMatch[1]);
        return {
            success: true,
            message: 'Демо-покупка выполнена. На GitHub Pages база данных не изменяется.',
            price: listing ? listing.Price : 0,
            commission: listing ? Number(listing.Price) * 0.05 : 0,
            sellerReceived: listing ? Number(listing.Price) * 0.95 : 0
        };
    }

    return undefined;
}

window.fetch = async function cs2Fetch(input, init) {
    const rawUrl = typeof input === 'string' ? input : input.url;
    const url = new URL(rawUrl, window.location.href);
    const isApiCall = url.pathname.includes('/api/') || rawUrl.startsWith('/api/');

    if (!window.CS2_STATIC_MODE || !isApiCall) {
        return CS2_ORIGINAL_FETCH(input, init);
    }

    try {
        const data = await cs2LoadStaticApi();
        const payload = cs2StaticPayload(data, cs2ApiEndpoint(url), url.searchParams, init);
        if (payload === undefined) {
            return cs2JsonResponse({ error: 'Этот API недоступен в GitHub Pages demo mode' }, 404);
        }
        return cs2JsonResponse(payload);
    } catch (error) {
        return cs2JsonResponse({ error: error.message }, 500);
    }
};

// ─── API Helper ───────────────────────────────────────────────────────────────
async function apiFetch(url) {
    const res = await fetch(url);
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

// ─── Форматирование ───────────────────────────────────────────────────────────
function fmt(n) {
    if (n == null) return '—';
    return Number(n).toLocaleString('ru-RU');
}

function fmtMoney(n) {
    if (n == null) return '0';
    return Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

// ─── Экранирование HTML ───────────────────────────────────────────────────────
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ─── Quality badge HTML ───────────────────────────────────────────────────────
const QUALITY_SHORT = {
    'Factory New':   'FN',
    'Minimal Wear':  'MW',
    'Field-Tested':  'FT',
    'Well-Worn':     'WW',
    'Battle-Scarred':'BS',
};

function qualityBadge(q) {
    if (!q) return '<span class="quality-badge">—</span>';
    const short = QUALITY_SHORT[q] || q.substring(0,2).toUpperCase();
    const cls = 'quality-' + short;
    return `<span class="quality-badge ${cls}" title="${esc(q)}">${short}</span>`;
}

// ─── Ошибка ───────────────────────────────────────────────────────────────────
function errHtml(e) {
    return `<div class="loading" style="flex-direction:column; gap:8px; color:var(--accent3);">
        <span style="font-size:2rem;">⚠️</span>
        <span>Ошибка загрузки: ${esc(e.message)}</span>
        <small class="text-muted">Проверьте подключение к БД в .env</small>
    </div>`;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, isError = false) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast' + (isError ? ' error' : '') + ' show';
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Автообновление данных каждые 30 секунд (только на главной) ──────────────
if (window.location.pathname === '/') {
    setInterval(() => {
        if (typeof loadHome === 'function') loadHome();
    }, 30000);
}
// ─── Покупка скина ───────────────────────────────────────────
async function buySkin(listingId, buyerId, price, skinName) {
    if (!confirm(`Подтвердите покупку "${skinName}" за ${fmtMoney(price)} ₽?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/buy/${listingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyerId: buyerId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast(`✅ ${result.message}`, false);
            
            // Обновляем страницу через 1.5 секунды
            setTimeout(() => {
                if (typeof loadMarket === 'function') {
                    loadMarket(); // Обновляем маркет
                } else if (typeof loadHome === 'function') {
                    loadHome(); // Обновляем главную
                }
                // Обновляем баланс если есть
                if (typeof updateBalanceDisplay === 'function') {
                    updateBalanceDisplay(buyerId);
                }
            }, 1500);
        } else {
            showToast(`❌ Ошибка: ${result.error}`, true);
        }
    } catch (err) {
        console.error('Ошибка покупки:', err);
        showToast(`❌ Ошибка: ${err.message}`, true);
    }
}

// ─── Показать историю покупок ─────────────────────────────────
async function showPurchaseHistory(userId) {
    const modal = document.getElementById('history-modal');
    const content = document.getElementById('history-content');
    
    if (!modal) return;
    
    modal.style.display = 'flex';
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Загрузка истории...</div>';
    
    try {
        const history = await apiFetch(`/api/user/${userId}/purchase-history`);
        
        if (!history.length) {
            content.innerHTML = '<div class="loading">📭 История покупок пуста</div>';
        } else {
            content.innerHTML = `
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Дата</th>
                                <th>Скин</th>
                                <th>Оружие</th>
                                <th>Качество</th>
                                <th>Цена</th>
                                <th>Продавец</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${history.map(item => `
                                <tr>
                                    <td class="text-sm">${new Date(item.TradeDate).toLocaleDateString('ru-RU')}</td>
                                    <td class="fw-600">${esc(item.SkinName)}</td>
                                    <td class="text-sec">${esc(item.WeaponName || '—')}</td>
                                    <td>${qualityBadge(item.Quality)}</td>
                                    <td class="td-price">${fmtMoney(item.Price)} ₽</td>
                                    <td class="text-sec">${esc(item.SellerName)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
    } catch (err) {
        content.innerHTML = errHtml(err);
    }
}

// ─── Обновление баланса (временно, пока нет авторизации) ─────
async function updateBalanceDisplay(userId) {
    try {
        const user = await apiFetch(`/api/user/${userId}/balance`);
        const balanceEl = document.getElementById('user-balance');
        if (balanceEl) {
            balanceEl.textContent = fmtMoney(user.Balance) + ' ₽';
        }
    } catch (err) {
        console.error('Ошибка обновления баланса:', err);
    }
}

// ─── Закрыть модальное окно ─────────────────────────────────
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// ─── Клик вне модального окна для закрытия ─────────────────
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
};
