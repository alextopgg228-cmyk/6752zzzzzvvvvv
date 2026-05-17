const axios = require('axios');
const sql = require('mssql');
require('dotenv').config();

// Конфигурация подключения к вашей БД
const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
        trustServerCertificate: true,
        encrypt: false,
    }
};

// Функция для получения цены и маркет-хеша из официального прайс-листа Steam
async function getItemFromSteamPriceList(itemName) {
    const url = 'https://steamcommunity.com/market/priceoverview/?currency=1&appid=730&market_hash_name=' + encodeURIComponent(itemName);
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        return null;
    }
}

async function addAllSkinImages() {
    try {
        await sql.connect(config);
        console.log('✅ Подключено к базе данных');

        // 1. Получаем все скины, у которых нет фото
        const result = await sql.query(`
            SELECT SkinID, SkinName, WeaponName 
            FROM Skins 
            WHERE ImageURL IS NULL OR ImageURL = ''
        `);
        const mySkins = result.recordset;
        console.log(`🎯 Найдено скинов без фото: ${mySkins.length}`);

        let updated = 0;
        let notFound = 0;

        // 2. Обрабатываем каждый скин
        for (const skin of mySkins) {
            // Формируем точное название для Steam (как в игре)
            const marketHashName = `${skin.WeaponName} | ${skin.SkinName}`;
            console.log(`🔍 Обрабатываю: ${marketHashName}`);

            // Проверяем существование предмета через официальное API Steam
            const itemData = await getItemFromSteamPriceList(marketHashName);
            
            if (itemData && itemData.success) {
                // Steam API подтвердил, что предмет существует
                // Формируем URL изображения (качество 360px)
                const imageUrl = `https://community.cloudflare.steamstatic.com/economy/image/${itemData.market_hash_name}/360fx360f`;
                
                // Сохраняем ссылку в базу данных
                await sql.query(`
                    UPDATE Skins 
                    SET ImageURL = '${imageUrl}'
                    WHERE SkinID = ${skin.SkinID}
                `);
                console.log(`   ✅ Фото добавлено!`);
                updated++;
            } else {
                console.log(`   ❌ Не найдено в Steam Market.`);
                notFound++;
            }
            
            // Небольшая задержка, чтобы не перегружать API Steam
            await new Promise(r => setTimeout(r, 500));
        }

        console.log(`\n📊 Готово! Обновлено: ${updated}, Не найдено: ${notFound}`);
        await sql.close();

    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
}

addAllSkinImages();