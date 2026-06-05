// public/js/app.js — общий клиентский JS для всех страниц

const CS2_ORIGINAL_FETCH = window.fetch.bind(window);
let CS2_STATIC_API_CACHE = null;
const CS2_MARKET_STATE_KEY = 'cs2-market-demo-state-v2';

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

function cs2ReadMarketState() {
    try {
        return JSON.parse(localStorage.getItem(CS2_MARKET_STATE_KEY) || '{}');
    } catch (error) {
        return {};
    }
}

function cs2WriteMarketState(state) {
    localStorage.setItem(CS2_MARKET_STATE_KEY, JSON.stringify(state));
}

function cs2StateDefaults() {
    return {
        purchasedListingIds: [],
        balances: {},
        purchaseHistory: {},
        sellerListings: [],
        listedInventoryIds: [],
        listingSeed: 5000,
        tradeSeed: 2000
    };
}

function cs2GetMarketState() {
    return { ...cs2StateDefaults(), ...cs2ReadMarketState() };
}

function cs2UserBalance(data, userId, state = cs2GetMarketState()) {
    if (state.balances && state.balances[String(userId)] != null) {
        return Number(state.balances[String(userId)]);
    }
    const user = data.usersDetail.find(item => String(item.UserID) === String(userId));
    return Number(user ? user.Balance : 0);
}

function cs2UsersWithState(data, state = cs2GetMarketState()) {
    return data.usersDetail.map(user => ({
        ...user,
        Balance: cs2UserBalance(data, user.UserID, state)
    }));
}

function cs2SellerNameForUser(data, userId) {
    const user = data.usersDetail.find(item => String(item.UserID) === String(userId));
    return user ? user.Username : '';
}

function cs2AllListings(data, state = cs2GetMarketState()) {
    return data.listings.concat(state.sellerListings || []);
}

function cs2ActiveListings(data, state = cs2GetMarketState()) {
    const purchased = new Set((state.purchasedListingIds || []).map(String));
    return cs2AllListings(data, state).filter(item => !purchased.has(String(item.ListingID)) && item.Status !== 'Sold');
}

function cs2SellerListings(data, userId, state = cs2GetMarketState()) {
    const sellerName = cs2SellerNameForUser(data, userId);
    return cs2ActiveListings(data, state)
        .filter(item => item.SellerName === sellerName)
        .sort((a, b) => {
            const bDate = new Date(b.ListedDate || 0).getTime();
            const aDate = new Date(a.ListedDate || 0).getTime();
            return (bDate - aDate) || (Number(b.ListingID || 0) - Number(a.ListingID || 0));
        });
}

function cs2WearRating(floatValue) {
    const value = Number(floatValue || 0.5);
    if (value < 0.07) return 'Excellent';
    if (value < 0.15) return 'Good';
    if (value < 0.38) return 'Average';
    return 'Poor';
}

function cs2PriceRating(price, marketPrice) {
    const currentPrice = Number(price || 0);
    const currentMarket = Number(marketPrice || currentPrice || 1);
    if (currentPrice <= currentMarket * 0.9) return 'Below Market';
    if (currentPrice >= currentMarket * 1.1) return 'Above Market';
    return 'Market Price';
}

function cs2SellerInventory(data, userId, state = cs2GetMarketState()) {
    const listed = new Set((state.listedInventoryIds || []).map(String));
    const sellerName = cs2SellerNameForUser(data, userId);
    const templates = data.listings
        .filter(item => item.SellerName !== sellerName)
        .slice(0, 6)
        .map((item, index) => ({
            InventoryID: `${userId}-${item.ListingID}`,
            SkinID: item.SkinID || item.ListingID,
            SkinName: item.SkinName,
            WeaponName: item.WeaponName,
            Quality: item.Quality,
            FloatValue: item.FloatValue,
            ImageURL: item.ImageURL,
            MarketPrice: item.MarketPrice || item.Price,
            WearRating: item.WearRating || cs2WearRating(item.FloatValue)
        }));
    return templates.filter(item => !listed.has(String(item.InventoryID)));
}

function cs2CreateSellerListing(data, init) {
    let body = {};
    try {
        body = init && init.body ? JSON.parse(init.body) : {};
    } catch (error) {
        body = {};
    }

    const state = cs2GetMarketState();
    const sellerId = Number(body.sellerId || 0);
    const inventoryId = String(body.inventoryId || '');
    const price = Number(body.price || 0);
    const sellerName = cs2SellerNameForUser(data, sellerId);
    const inventoryItem = cs2SellerInventory(data, sellerId, state)
        .find(item => String(item.InventoryID) === inventoryId);

    if (!sellerName) {
        return { status: 400, payload: { success: false, error: 'Продавец не найден' } };
    }
    if (!inventoryItem) {
        return { status: 400, payload: { success: false, error: 'Скин уже выставлен или не найден в инвентаре' } };
    }
    if (!Number.isFinite(price) || price <= 0) {
        return { status: 400, payload: { success: false, error: 'Укажите корректную цену' } };
    }

    state.listingSeed = Number(state.listingSeed || 5000) + 1;
    state.listedInventoryIds = state.listedInventoryIds || [];
    state.sellerListings = state.sellerListings || [];
    const listing = {
        ListingID: state.listingSeed,
        SkinID: inventoryItem.SkinID,
        SkinName: inventoryItem.SkinName,
        WeaponName: inventoryItem.WeaponName,
        Quality: inventoryItem.Quality,
        FloatValue: inventoryItem.FloatValue,
        ImageURL: inventoryItem.ImageURL,
        WearRating: inventoryItem.WearRating || cs2WearRating(inventoryItem.FloatValue),
        Price: price,
        SellerName: sellerName,
        PriceRating: cs2PriceRating(price, inventoryItem.MarketPrice),
        MarketPrice: inventoryItem.MarketPrice,
        ListedDate: new Date().toISOString(),
        Status: 'Active'
    };

    state.listedInventoryIds.push(inventoryId);
    state.sellerListings.unshift(listing);
    cs2WriteMarketState(state);

    return {
        status: 200,
        payload: {
            success: true,
            message: `Объявление создано: ${listing.WeaponName} | ${listing.SkinName}`,
            listing
        }
    };
}

function cs2TopListings(activeListings) {
    return activeListings
        .slice()
        .sort((a, b) => Number(b.Price) - Number(a.Price))
        .slice(0, 5)
        .map(({ ListingID, SkinName, WeaponName, Quality, Price, SellerName, ImageURL }) => ({
            ListingID, SkinName, WeaponName, Quality, Price, SellerName, ImageURL
        }));
}

function cs2HistoryForUser(data, userId, state = cs2GetMarketState()) {
    const base = data.purchaseHistory[String(userId)] || [];
    const extra = state.purchaseHistory[String(userId)] || [];
    return extra.concat(base).sort((a, b) => new Date(b.TradeDate) - new Date(a.TradeDate));
}

function cs2StatsWithState(data, state = cs2GetMarketState()) {
    const purchasedIds = new Set((state.purchasedListingIds || []).map(String));
    const purchasedListings = cs2AllListings(data, state).filter(item => purchasedIds.has(String(item.ListingID)));
    const purchasedVolume = purchasedListings.reduce((sum, item) => sum + Number(item.Price || 0), 0);
    return {
        ...data.stats,
        ActiveListings: cs2ActiveListings(data, state).length,
        CompletedTrades: Number(data.stats.CompletedTrades || 0) + purchasedListings.length,
        TotalVolume: Number(data.stats.TotalVolume || 0) + purchasedVolume
    };
}

function cs2BuyListing(data, listingId, init) {
    const state = cs2GetMarketState();
    const purchased = new Set((state.purchasedListingIds || []).map(String));
    const listing = data.listings.find(item => String(item.ListingID) === String(listingId));
    if (!listing || purchased.has(String(listingId))) {
        return { status: 409, payload: { success: false, error: 'Объявление уже куплено или недоступно' } };
    }

    let body = {};
    try {
        body = init && init.body ? JSON.parse(init.body) : {};
    } catch (error) {
        body = {};
    }
    const session = typeof getCurrentRoleSession === 'function' ? getCurrentRoleSession() : {};
    const buyerId = Number(body.buyerId || session.userId || 1);
    const currentBalance = cs2UserBalance(data, buyerId, state);
    const price = Number(listing.Price || 0);
    if (currentBalance < price) {
        return {
            status: 400,
            payload: {
                success: false,
                error: `Недостаточно средств. Нужно ${fmtMoney(price)} ₽, доступно ${fmtMoney(currentBalance)} ₽`
            }
        };
    }

    const commission = Number((price * 0.05).toFixed(2));
    const sellerReceived = Number((price - commission).toFixed(2));
    state.purchasedListingIds = Array.from(purchased).concat(String(listingId));
    state.balances = state.balances || {};
    state.balances[String(buyerId)] = Number((currentBalance - price).toFixed(2));

    const seller = data.usersDetail.find(user => user.Username === listing.SellerName);
    if (seller) {
        state.balances[String(seller.UserID)] = Number((cs2UserBalance(data, seller.UserID, state) + sellerReceived).toFixed(2));
    }

    state.tradeSeed = Number(state.tradeSeed || 2000) + 1;
    state.purchaseHistory = state.purchaseHistory || {};
    state.purchaseHistory[String(buyerId)] = state.purchaseHistory[String(buyerId)] || [];
    state.purchaseHistory[String(buyerId)].unshift({
        TradeID: state.tradeSeed,
        TradeDate: new Date().toISOString(),
        Price: price,
        SkinName: listing.SkinName,
        WeaponName: listing.WeaponName,
        Quality: listing.Quality,
        SellerName: listing.SellerName
    });
    cs2WriteMarketState(state);

    return {
        status: 200,
        payload: {
            success: true,
            message: `Покупка выполнена: ${listing.WeaponName} | ${listing.SkinName}`,
            price,
            commission,
            sellerReceived,
            newBalance: state.balances[String(buyerId)]
        }
    };
}

function cs2StaticPayload(data, endpoint, searchParams, init) {
    const state = cs2GetMarketState();
    const activeListings = cs2ActiveListings(data, state);
    if (endpoint === '/auth/login' && init && String(init.method || 'GET').toUpperCase() === 'POST') {
        let body = {};
        try {
            body = init.body ? JSON.parse(init.body) : {};
        } catch (error) {
            body = {};
        }
        return cs2Authenticate(body.login, body.password);
    }
    if (endpoint === '/stats') return cs2StatsWithState(data, state);
    if (endpoint === '/top-listings') return cs2TopListings(activeListings);
    if (endpoint === '/top-users') return data.topUsers;
    if (endpoint === '/categories') return data.categories;
    if (endpoint === '/quality-stats') return data.qualityStats;
    if (endpoint === '/sales-dynamics') return data.salesDynamics;
    if (endpoint === '/rich-users') return data.richUsers;
    if (endpoint === '/popular-skins') return data.popularSkins;
    if (endpoint === '/users-detail') return cs2UsersWithState(data, state);
    if (endpoint === '/listings') return cs2FilterListings(activeListings, searchParams);

    const sellerListingsMatch = endpoint.match(/^\/seller\/(\d+)\/listings$/);
    if (sellerListingsMatch) {
        return cs2SellerListings(data, sellerListingsMatch[1], state);
    }

    const sellerInventoryMatch = endpoint.match(/^\/seller\/(\d+)\/inventory$/);
    if (sellerInventoryMatch) {
        return cs2SellerInventory(data, sellerInventoryMatch[1], state);
    }

    if (endpoint === '/seller/listings' && init && String(init.method || 'GET').toUpperCase() === 'POST') {
        return cs2CreateSellerListing(data, init);
    }

    const balanceMatch = endpoint.match(/^\/user\/(\d+)\/balance$/);
    if (balanceMatch) {
        const user = cs2UsersWithState(data, state).find(item => String(item.UserID) === balanceMatch[1]);
        return user || data.currentUser;
    }

    const historyMatch = endpoint.match(/^\/user\/(\d+)\/purchase-history$/);
    if (historyMatch) {
        return cs2HistoryForUser(data, historyMatch[1], state);
    }

    const buyMatch = endpoint.match(/^\/buy\/(\d+)$/);
    if (buyMatch && (!init || !init.method || String(init.method).toUpperCase() === 'POST')) {
        return cs2BuyListing(data, buyMatch[1], init);
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
        if (payload && payload.payload !== undefined && payload.status !== undefined) {
            return cs2JsonResponse(payload.payload, payload.status);
        }
        return cs2JsonResponse(payload);
    } catch (error) {
        return cs2JsonResponse({ error: error.message }, 500);
    }
};

const CS2_ROLE_STORAGE_KEY = 'cs2-role-session';
const CS2_AUTH_USERS = {
    buyer: {
        login: 'buyer',
        password: 'buyer123',
        role: 'buyer'
    },
    seller: {
        login: 'seller',
        password: 'seller123',
        role: 'seller'
    },
    moderator: {
        login: 'moderator',
        password: 'moderator123',
        role: 'moderator'
    },
    admin: {
        login: 'admin',
        password: 'admin123',
        role: 'admin'
    }
};

const CS2_ROLES = {
    guest: {
        title: 'Гость',
        badge: 'Guest',
        username: 'Гость',
        description: 'Может смотреть витрину и общую статистику без служебных действий.',
        userId: null,
        balance: 0,
        permissions: ['browse']
    },
    buyer: {
        title: 'Покупатель',
        badge: 'Buyer',
        username: 'SkinMaster',
        description: 'Покупает скины, смотрит баланс и историю своих покупок.',
        userId: 1,
        balance: 500000,
        permissions: ['browse', 'buy', 'history']
    },
    seller: {
        title: 'Продавец',
        badge: 'Seller',
        username: 'PixelBroker',
        description: 'Работает с объявлениями, ценами и своим инвентарем.',
        userId: 4,
        balance: 132900,
        permissions: ['browse', 'sell', 'history', 'analytics']
    },
    moderator: {
        title: 'Модератор',
        badge: 'Moderation',
        username: 'TradeModerator',
        description: 'Проверяет жалобы, спорные сделки и подозрительные объявления.',
        userId: 6,
        balance: 92000,
        permissions: ['browse', 'analytics', 'moderate', 'audit']
    },
    admin: {
        title: 'Администратор',
        badge: 'Admin',
        username: 'MarketAdmin',
        description: 'Управляет пользователями, ролями и операционными разделами маркета.',
        userId: 2,
        balance: 318250,
        permissions: ['browse', 'buy', 'sell', 'history', 'analytics', 'moderate', 'manageUsers', 'audit']
    }
};

function cs2Authenticate(login, password) {
    const normalizedLogin = String(login || '').trim().toLowerCase();
    const account = Object.values(CS2_AUTH_USERS).find(item =>
        item.login === normalizedLogin && item.password === String(password || '')
    );
    if (!account) {
        return { status: 401, payload: { success: false, error: 'Неверный логин или пароль' } };
    }
    const role = getRoleConfig(account.role);
    return {
        status: 200,
        payload: {
            success: true,
            user: {
                login: account.login,
                role: account.role,
                title: role.title,
                username: role.username,
                userId: role.userId,
                balance: role.balance,
                permissions: role.permissions
            }
        }
    };
}

function getRoleConfig(roleId) {
    return CS2_ROLES[roleId] || CS2_ROLES.guest;
}

function getCurrentRoleSession() {
    try {
        const stored = JSON.parse(localStorage.getItem(CS2_ROLE_STORAGE_KEY) || '{}');
        const roleId = stored.role && CS2_ROLES[stored.role] ? stored.role : 'guest';
        return {
            role: roleId,
            ...getRoleConfig(roleId),
            login: stored.login || null,
            signedInAt: stored.signedInAt || null
        };
    } catch (error) {
        return { role: 'guest', ...CS2_ROLES.guest };
    }
}

function roleCan(permission) {
    const role = getCurrentRoleSession();
    return role.permissions.includes(permission);
}

function roleCanOpenAdmin() {
    return roleCan('moderate') || roleCan('manageUsers');
}

function roleCanOpenSales() {
    return roleCan('sell');
}

function loginAsRole(roleId) {
    if (!CS2_ROLES[roleId] || roleId === 'guest') return;
    localStorage.setItem(CS2_ROLE_STORAGE_KEY, JSON.stringify({
        role: roleId,
        login: roleId,
        signedInAt: new Date().toISOString()
    }));
    closeModal('login-modal');
    applyRoleSession();
    window.dispatchEvent(new CustomEvent('cs2-role-changed', { detail: getCurrentRoleSession() }));
    showToast(`Вход выполнен: ${CS2_ROLES[roleId].title}`);
}

async function loginWithCredentials(event) {
    if (event) event.preventDefault();
    const loginInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const errorEl = document.getElementById('login-error');
    const login = loginInput ? loginInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (errorEl) errorEl.textContent = '';
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password })
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Неверный логин или пароль');
        }
        localStorage.setItem(CS2_ROLE_STORAGE_KEY, JSON.stringify({
            role: result.user.role,
            login: result.user.login,
            signedInAt: new Date().toISOString()
        }));
        closeModal('login-modal');
        applyRoleSession();
        if (typeof loadUserBalance === 'function') loadUserBalance();
        window.dispatchEvent(new CustomEvent('cs2-role-changed', { detail: getCurrentRoleSession() }));
        showToast(`Вход выполнен: ${result.user.title}`);
    } catch (error) {
        if (errorEl) errorEl.textContent = error.message;
        showToast(error.message, true);
    }
}

function fillDemoLogin(login) {
    const account = CS2_AUTH_USERS[login];
    if (!account) return;
    const loginInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    if (loginInput) loginInput.value = account.login;
    if (passwordInput) passwordInput.value = account.password;
}

function logoutRole() {
    localStorage.removeItem(CS2_ROLE_STORAGE_KEY);
    applyRoleSession();
    window.dispatchEvent(new CustomEvent('cs2-role-changed', { detail: getCurrentRoleSession() }));
    showToast('Вы вышли из роли');
}

function openLoginModal() {
    renderRoleOptions();
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
}

function renderRoleOptions() {
    const wrap = document.getElementById('role-options');
    if (!wrap) return;
    wrap.innerHTML = `
        <form class="login-form" onsubmit="loginWithCredentials(event)">
            <div class="form-group">
                <label class="form-label" for="login-username">Логин</label>
                <input class="form-control" id="login-username" autocomplete="username" placeholder="buyer">
            </div>
            <div class="form-group">
                <label class="form-label" for="login-password">Пароль</label>
                <input class="form-control" id="login-password" type="password" autocomplete="current-password" placeholder="buyer123">
            </div>
            <div class="login-error" id="login-error"></div>
            <button class="btn btn-primary" type="submit">Войти</button>
        </form>
        <div class="demo-users">
            ${Object.values(CS2_AUTH_USERS).map(account => {
                const role = getRoleConfig(account.role);
                return `
                    <button class="demo-user" type="button" onclick="fillDemoLogin('${esc(account.login)}')">
                        <span>
                            <strong>${esc(role.title)}</strong>
                            <small>${esc(account.login)} / ${esc(account.password)}</small>
                        </span>
                        <span class="role-chip">${esc(role.badge)}</span>
                    </button>
                `;
            }).join('')}
        </div>
    `;
}

function applyRoleSession() {
    const session = getCurrentRoleSession();
    const nameEl = document.getElementById('user-name');
    const badgeEl = document.getElementById('user-role-badge');
    const balanceLine = document.getElementById('balance-line');
    const balanceEl = document.getElementById('user-balance');
    const historyButton = document.getElementById('history-button');
    const adminShortcut = document.getElementById('admin-shortcut');
    const salesShortcut = document.getElementById('sales-shortcut');
    const logoutButton = document.getElementById('logout-button');
    const loginButton = document.getElementById('login-button');
    const adminNav = document.getElementById('nav-admin');
    const salesNav = document.getElementById('nav-sales');

    if (nameEl) nameEl.textContent = session.username;
    if (badgeEl) badgeEl.textContent = session.title;
    if (balanceEl) balanceEl.textContent = fmtMoney(session.balance || 0) + ' ₽';
    if (balanceLine) balanceLine.style.display = session.userId ? 'inline' : 'none';
    if (historyButton) historyButton.style.display = roleCan('history') ? 'inline-flex' : 'none';
    if (adminShortcut) adminShortcut.style.display = roleCanOpenAdmin() ? 'inline-flex' : 'none';
    if (salesShortcut) salesShortcut.style.display = roleCanOpenSales() ? 'inline-flex' : 'none';
    if (adminNav) adminNav.style.display = roleCanOpenAdmin() ? 'block' : 'none';
    if (salesNav) salesNav.style.display = roleCanOpenSales() ? 'block' : 'none';
    if (loginButton) loginButton.style.display = session.role === 'guest' ? 'inline-flex' : 'none';
    if (logoutButton) logoutButton.style.display = session.role === 'guest' ? 'none' : 'inline-flex';
}

window.CS2_ROLES = CS2_ROLES;
window.CS2_AUTH_USERS = CS2_AUTH_USERS;

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

function getPriceClass(p) {
    if (p === 'Below Market') return 'price-below';
    if (p === 'Above Market') return 'price-above';
    return 'price-market';
}

function skinPreview(url, name) {
    if (!url) return '<span class="skin-preview skin-preview-empty">CS2</span>';
    return `<span class="skin-preview">
        <img src="${esc(url)}" alt="${esc(name || 'CS2 skin')}" loading="lazy" onerror="this.style.display='none'">
    </span>`;
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
    if (!roleCan('buy')) {
        openLoginModal();
        showToast('Для покупки войдите как покупатель или администратор', true);
        return;
    }
    const session = getCurrentRoleSession();
    const targetBuyerId = session.userId || buyerId;
    if (!confirm(`Подтвердите покупку "${skinName}" за ${fmtMoney(price)} ₽?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/buy/${listingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ buyerId: targetBuyerId })
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
                    updateBalanceDisplay(targetBuyerId);
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
    const session = getCurrentRoleSession();
    const targetUserId = userId || session.userId;
    if (!targetUserId || !roleCan('history')) {
        openLoginModal();
        showToast('Для истории покупок войдите как покупатель или администратор', true);
        return;
    }
    const modal = document.getElementById('history-modal');
    const content = document.getElementById('history-content');
    
    if (!modal) return;
    
    modal.style.display = 'flex';
    content.innerHTML = '<div class="loading"><div class="spinner"></div>Загрузка истории...</div>';
    
    try {
        const history = await apiFetch(`/api/user/${targetUserId}/purchase-history`);
        
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
    const session = getCurrentRoleSession();
    const targetUserId = userId || session.userId;
    if (!targetUserId) {
        applyRoleSession();
        return;
    }
    try {
        const user = await apiFetch(`/api/user/${targetUserId}/balance`);
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
document.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});
