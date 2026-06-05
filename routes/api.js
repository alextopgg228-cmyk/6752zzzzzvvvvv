const express = require('express');
const router = express.Router();
const { sql, query } = require('../db');
 
// Хелпер — запрос с логом времени
async function tquery(name, q, params = {}) {
    const t = Date.now();
    console.log(`→ [${name}] запрос...`);
    try {
        const r = await query(q, params);
        console.log(`✅ [${name}] готово за ${Date.now()-t}ms, строк: ${r.recordset.length}`);
        return r;
    } catch(e) {
        console.error(`❌ [${name}] ошибка за ${Date.now()-t}ms:`, e.message);
        throw e;
    }
}

const DEMO_AUTH_USERS = {
    buyer: {
        login: 'buyer',
        password: 'buyer123',
        role: 'buyer',
        title: 'Покупатель',
        username: 'SkinMaster',
        userId: 1,
        balance: 500000,
        permissions: ['browse', 'buy', 'history']
    },
    seller: {
        login: 'seller',
        password: 'seller123',
        role: 'seller',
        title: 'Продавец',
        username: 'PixelBroker',
        userId: 4,
        balance: 132900,
        permissions: ['browse', 'sell', 'history', 'analytics']
    },
    moderator: {
        login: 'moderator',
        password: 'moderator123',
        role: 'moderator',
        title: 'Модератор',
        username: 'TradeModerator',
        userId: 6,
        balance: 92000,
        permissions: ['browse', 'analytics', 'moderate', 'audit']
    },
    admin: {
        login: 'admin',
        password: 'admin123',
        role: 'admin',
        title: 'Администратор',
        username: 'MarketAdmin',
        userId: 2,
        balance: 318250,
        permissions: ['browse', 'buy', 'sell', 'history', 'analytics', 'moderate', 'manageUsers', 'audit']
    }
};

router.post('/auth/login', (req, res) => {
    const login = String(req.body.login || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const account = Object.values(DEMO_AUTH_USERS).find(user => user.login === login && user.password === password);

    if (!account) {
        return res.status(401).json({ success: false, error: 'Неверный логин или пароль' });
    }

    const { password: _password, ...user } = account;
    res.json({ success: true, user });
});
 
router.get('/stats', async (req, res) => {
    try {
        const r = await tquery('stats', `
            SELECT 
                (SELECT COUNT(*) FROM Users) AS TotalUsers,
                (SELECT COUNT(*) FROM Skins) AS TotalSkins,
                (SELECT COUNT(*) FROM Listings WHERE Status = 'Active') AS ActiveListings,
                (SELECT COUNT(*) FROM Trades WHERE TradeStatus = 'Completed') AS CompletedTrades,
                (SELECT ISNULL(SUM(FinalPrice), 0) FROM Trades WHERE TradeStatus = 'Completed') AS TotalVolume
        `);
        res.json(r.recordset[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/top-listings', async (req, res) => {
    try {
        const r = await tquery('top-listings', `
            SELECT TOP 5 L.ListingID, S.SkinName, S.WeaponName, S.Quality, 
                         L.Price, U.Username AS SellerName
            FROM Listings L
            JOIN Skins S ON L.SkinID = S.SkinID
            JOIN Users U ON L.SellerID = U.UserID
            WHERE L.Status = 'Active'
            ORDER BY L.Price DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/top-users', async (req, res) => {
    try {
        const r = await tquery('top-users', `
            SELECT TOP 5 U.UserID, U.Username, U.TotalTrades, U.Balance,
                (SELECT COUNT(*) FROM Listings WHERE SellerID = U.UserID AND Status = 'Active') AS ActiveListings
            FROM Users U ORDER BY U.TotalTrades DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/categories', async (req, res) => {
    try {
        const r = await tquery('categories', `
            SELECT C.CategoryName,
                COUNT(T.TradeID) AS SalesCount,
                ISNULL(SUM(T.FinalPrice), 0) AS TotalRevenue,
                ISNULL(AVG(T.FinalPrice), 0) AS AvgPrice
            FROM SkinCategories C
            LEFT JOIN Skins S ON C.CategoryID = S.CategoryID
            LEFT JOIN Listings L ON S.SkinID = L.SkinID
            LEFT JOIN Trades T ON L.ListingID = T.ListingID AND T.TradeStatus = 'Completed'
            GROUP BY C.CategoryID, C.CategoryName
            ORDER BY TotalRevenue DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/quality-stats', async (req, res) => {
    try {
        const r = await tquery('quality-stats', `
            SELECT S.Quality,
                COUNT(DISTINCT S.SkinID) AS TotalSkins,
                COUNT(T.TradeID) AS SalesCount,
                ISNULL(AVG(T.FinalPrice), 0) AS AvgSalePrice
            FROM Skins S
            LEFT JOIN Listings L ON S.SkinID = L.SkinID
            LEFT JOIN Trades T ON L.ListingID = T.ListingID AND T.TradeStatus = 'Completed'
            WHERE S.Quality IS NOT NULL
            GROUP BY S.Quality
            ORDER BY AvgSalePrice DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/sales-dynamics', async (req, res) => {
    try {
        const r = await tquery('sales-dynamics', `
            SELECT CAST(T.TradeDate AS DATE) AS TradeDay,
                COUNT(T.TradeID) AS SalesCount,
                SUM(T.FinalPrice) AS DailyRevenue
            FROM Trades T
            WHERE T.TradeStatus = 'Completed'
              AND T.TradeDate >= DATEADD(day, -14, GETDATE())
            GROUP BY CAST(T.TradeDate AS DATE)
            ORDER BY TradeDay ASC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/rich-users', async (req, res) => {
    try {
        const r = await tquery('rich-users', `
            SELECT UserID, Username, Balance, TotalTrades,
                Balance - AVG(Balance) OVER () AS DifferenceFromAvg
            FROM Users
            WHERE Balance > (SELECT AVG(Balance) FROM Users)
            ORDER BY Balance DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/popular-skins', async (req, res) => {
    try {
        const r = await tquery('popular-skins', `
            SELECT TOP 5 S.SkinName, S.WeaponName, S.Quality,
                COUNT(T.TradeID) AS TimesSold,
                AVG(T.FinalPrice) AS AvgSoldPrice
            FROM Skins S
            JOIN Listings L ON S.SkinID = L.SkinID
            JOIN Trades T ON L.ListingID = T.ListingID
            WHERE T.TradeStatus = 'Completed'
            GROUP BY S.SkinID, S.SkinName, S.WeaponName, S.Quality, S.MarketPrice
            ORDER BY TimesSold DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/users-detail', async (req, res) => {
    try {
        const r = await tquery('users-detail', `
            SELECT
                U.UserID, U.Username, U.Balance, U.TotalTrades,
                ISNULL((
                    SELECT SUM(S.MarketPrice) FROM UserInventory UI
                    JOIN Skins S ON UI.SkinID = S.SkinID
                    WHERE UI.UserID = U.UserID
                ), 0) AS InventoryValue,
                ISNULL((
                    SELECT COUNT(*) FROM Listings L
                    WHERE L.SellerID = U.UserID AND L.Status = 'Active'
                ), 0) AS ActiveListings,
                ISNULL((
                    SELECT AVG(T.FinalPrice) FROM Trades T
                    WHERE T.SellerID = U.UserID AND T.TradeStatus = 'Completed'
                ), 0) AS AvgSalePrice
            FROM Users U
            ORDER BY U.Balance DESC
        `);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});
 
router.get('/listings', async (req, res) => {
    try {
        const { quality, minPrice, maxPrice, search, sort } = req.query;
        let whereExtra = '';
        const params = {};
 
        if (quality && quality !== 'all') {
            whereExtra += ` AND S.Quality = @quality`;
            params.quality = { type: sql.NVarChar, value: quality };
        }
        if (minPrice) {
            whereExtra += ` AND L.Price >= @minPrice`;
            params.minPrice = { type: sql.Decimal(18,2), value: parseFloat(minPrice) };
        }
        if (maxPrice) {
            whereExtra += ` AND L.Price <= @maxPrice`;
            params.maxPrice = { type: sql.Decimal(18,2), value: parseFloat(maxPrice) };
        }
        if (search) {
            whereExtra += ` AND (S.SkinName LIKE @search OR S.WeaponName LIKE @search)`;
            params.search = { type: sql.NVarChar, value: `%${search}%` };
        }
 
        const orderMap = {
            'price_asc':  'L.Price ASC',
            'price_desc': 'L.Price DESC',
            'wear':       'S.FloatValue ASC',
            'name':       'S.SkinName ASC',
        };
 
        const r = await tquery('listings', `
            SELECT L.ListingID, S.SkinName, S.WeaponName, S.Quality, S.FloatValue,
                   S.ImageURL,
                   CASE 
                       WHEN S.FloatValue < 0.07 THEN 'Excellent'
                       WHEN S.FloatValue < 0.15 THEN 'Good'
                       WHEN S.FloatValue < 0.38 THEN 'Average'
                       ELSE 'Poor'
                   END AS WearRating,
                   L.Price, U.Username AS SellerName,
                   CASE 
                       WHEN L.Price <= S.MarketPrice * 0.9 THEN 'Below Market'
                       WHEN L.Price >= S.MarketPrice * 1.1 THEN 'Above Market'
                       ELSE 'Market Price'
                   END AS PriceRating,
                   S.MarketPrice
            FROM Listings L
            JOIN Skins S ON L.SkinID = S.SkinID
            JOIN Users U ON L.SellerID = U.UserID
            WHERE L.Status = 'Active' ${whereExtra}
            ORDER BY ${orderMap[sort] || 'L.Price DESC'}
        `, params);
        res.json(r.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── НОВЫЕ ЭНДПОИНТЫ ДЛЯ ПОКУПКИ И БАЛАНСА ───────────────────

// Баланс пользователя
router.get('/user/:userId/balance', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await query(`
            SELECT UserID, Username, Balance 
            FROM Users 
            WHERE UserID = @userId
        `, {
            userId: { type: sql.Int, value: parseInt(userId) }
        });
        
        if (result.recordset[0]) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: 'Пользователь не найден' });
        }
    } catch (err) {
        console.error('❌ Ошибка получения баланса:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// История покупок пользователя
router.get('/user/:userId/purchase-history', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const result = await query(`
            SELECT 
                T.TradeID,
                T.TradeDate,
                T.FinalPrice AS Price,
                S.SkinName,
                S.WeaponName,
                S.Quality,
                U.Username AS SellerName
            FROM Trades T
            JOIN Listings L ON T.ListingID = L.ListingID
            JOIN Skins S ON L.SkinID = S.SkinID
            JOIN Users U ON T.SellerID = U.UserID
            WHERE T.BuyerID = @userId AND T.TradeStatus = 'Completed'
            ORDER BY T.TradeDate DESC
        `, {
            userId: { type: sql.Int, value: parseInt(userId) }
        });
        
        res.json(result.recordset);
    } catch (err) {
        console.error('❌ Ошибка истории покупок:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/seller/:sellerId/listings', async (req, res) => {
    const { sellerId } = req.params;

    try {
        const result = await query(`
            SELECT L.ListingID, S.SkinID, S.SkinName, S.WeaponName, S.Quality, S.FloatValue,
                   S.ImageURL,
                   CASE
                       WHEN S.FloatValue < 0.07 THEN 'Excellent'
                       WHEN S.FloatValue < 0.15 THEN 'Good'
                       WHEN S.FloatValue < 0.38 THEN 'Average'
                       ELSE 'Poor'
                   END AS WearRating,
                   L.Price,
                   U.Username AS SellerName,
                   CASE
                       WHEN L.Price <= S.MarketPrice * 0.9 THEN 'Below Market'
                       WHEN L.Price >= S.MarketPrice * 1.1 THEN 'Above Market'
                       ELSE 'Market Price'
                   END AS PriceRating,
                   S.MarketPrice,
                   L.ListedDate,
                   L.Status
            FROM Listings L
            JOIN Skins S ON L.SkinID = S.SkinID
            JOIN Users U ON L.SellerID = U.UserID
            WHERE L.SellerID = @sellerId AND L.Status = 'Active'
            ORDER BY L.ListedDate DESC
        `, {
            sellerId: { type: sql.Int, value: parseInt(sellerId) }
        });

        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка загрузки объявлений продавца:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.get('/seller/:sellerId/inventory', async (req, res) => {
    const { sellerId } = req.params;

    try {
        const result = await query(`
            SELECT UI.InventoryID, S.SkinID, S.SkinName, S.WeaponName, S.Quality, S.FloatValue,
                   S.ImageURL, S.MarketPrice,
                   CASE
                       WHEN S.FloatValue < 0.07 THEN 'Excellent'
                       WHEN S.FloatValue < 0.15 THEN 'Good'
                       WHEN S.FloatValue < 0.38 THEN 'Average'
                       ELSE 'Poor'
                   END AS WearRating
            FROM UserInventory UI
            JOIN Skins S ON UI.SkinID = S.SkinID
            WHERE UI.UserID = @sellerId AND ISNULL(UI.IsListed, 0) = 0
            ORDER BY S.MarketPrice DESC
        `, {
            sellerId: { type: sql.Int, value: parseInt(sellerId) }
        });

        res.json(result.recordset);
    } catch (err) {
        console.error('Ошибка загрузки инвентаря продавца:', err.message);
        res.status(500).json({ error: err.message });
    }
});

router.post('/seller/listings', async (req, res) => {
    const sellerId = parseInt(req.body.sellerId);
    const inventoryId = parseInt(req.body.inventoryId);
    const price = Number(req.body.price);

    if (!sellerId || !inventoryId || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ success: false, error: 'Укажите продавца, скин и корректную цену' });
    }

    try {
        const result = await query(`
            DECLARE @SkinID INT;
            SELECT @SkinID = SkinID
            FROM UserInventory
            WHERE InventoryID = @inventoryId
              AND UserID = @sellerId
              AND ISNULL(IsListed, 0) = 0;

            IF @SkinID IS NULL
            BEGIN
                THROW 51000, 'Скин уже выставлен или не найден в инвентаре', 1;
            END

            INSERT INTO Listings (SkinID, SellerID, Price, ListedDate, Status, IsFloatVisible)
            VALUES (@SkinID, @sellerId, @price, GETDATE(), 'Active', 1);

            UPDATE UserInventory
            SET IsListed = 1
            WHERE InventoryID = @inventoryId;

            SELECT TOP 1 L.ListingID, S.SkinID, S.SkinName, S.WeaponName, S.Quality, S.FloatValue,
                   S.ImageURL, L.Price, U.Username AS SellerName, S.MarketPrice,
                   CASE
                       WHEN L.Price <= S.MarketPrice * 0.9 THEN 'Below Market'
                       WHEN L.Price >= S.MarketPrice * 1.1 THEN 'Above Market'
                       ELSE 'Market Price'
                   END AS PriceRating
            FROM Listings L
            JOIN Skins S ON L.SkinID = S.SkinID
            JOIN Users U ON L.SellerID = U.UserID
            WHERE L.ListingID = SCOPE_IDENTITY()
        `, {
            sellerId: { type: sql.Int, value: sellerId },
            inventoryId: { type: sql.Int, value: inventoryId },
            price: { type: sql.Decimal(12, 2), value: price }
        });

        res.json({
            success: true,
            message: 'Объявление создано',
            listing: result.recordset[0]
        });
    } catch (err) {
        console.error('Ошибка создания объявления продавца:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Покупка скина
router.post('/buy/:listingId', async (req, res) => {
    const { listingId } = req.params;
    const { buyerId } = req.body;
    
    if (!buyerId) {
        return res.status(400).json({ error: 'Не указан ID покупателя' });
    }
    
    try {
        const result = await query(`
            DECLARE @Result TABLE (
                Message NVARCHAR(200),
                Price DECIMAL(12,2),
                Commission DECIMAL(12,2),
                SellerReceived DECIMAL(12,2)
            );
            
            INSERT INTO @Result
            EXEC pr_BuySkin @ListingID = @listingId, @BuyerID = @buyerId;
            
            SELECT * FROM @Result;
        `, {
            listingId: { type: sql.Int, value: parseInt(listingId) },
            buyerId: { type: sql.Int, value: parseInt(buyerId) }
        });
        
        res.json({ 
            success: true, 
            message: result.recordset[0]?.Message || 'Покупка успешно совершена!',
            price: result.recordset[0]?.Price,
            commission: result.recordset[0]?.Commission,
            sellerReceived: result.recordset[0]?.SellerReceived
        });
        
    } catch (err) {
        console.error('❌ Ошибка покупки:', err.message);
        res.status(500).json({ error: err.message });
    }
});
 
module.exports = router;
