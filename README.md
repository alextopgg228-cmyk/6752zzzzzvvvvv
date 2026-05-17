# CS2 Skin Market — Веб-сайт

Веб-приложение для маркета скинов CS2, подключённое к базе данных `pr_Maksimenkov_skins` (Microsoft SQL Server).

## Технологии

- **Backend:** Node.js + Express
- **БД:** Microsoft SQL Server (через пакет `mssql`)
- **Шаблоны:** EJS
- **Frontend:** HTML/CSS/JS + Chart.js

## Структура проекта

```
cs2market/
├── server.js          ← Главный файл (запускать его)
├── db.js              ← Подключение к SQL Server
├── .env               ← Настройки (EDIT THIS FIRST!)
├── package.json
├── routes/
│   ├── api.js         ← Все API-эндпоинты (10 запросов)
│   └── pages.js       ← Рендер страниц
├── views/
│   ├── index.ejs      ← Главная страница
│   ├── market.ejs     ← Маркет с фильтрами
│   ├── analytics.ejs  ← Аналитика с графиками
│   ├── users.ejs      ← Таблица пользователей
│   └── partials/
│       ├── header.ejs
│       └── footer.ejs
└── public/
    ├── css/style.css
    └── js/app.js
```

## Установка

### Шаг 1: Установить зависимости

Открой папку в терминале (VS Code → Terminal → New Terminal):

```bash
npm install
```

### Шаг 2: Настроить подключение к БД

Открой файл `.env` и измени параметры:

#### Вариант А — SQL Server Authentication (логин/пароль):
```env
DB_SERVER=localhost
DB_DATABASE=pr_Maksimenkov_skins
DB_USER=sa
DB_PASSWORD=твой_пароль
DB_PORT=1433
DB_TRUSTED=false
PORT=3000
```

#### Вариант Б — Windows Authentication (без пароля):
```env
DB_SERVER=localhost
DB_DATABASE=pr_Maksimenkov_skins
DB_PORT=1433
DB_TRUSTED=true
PORT=3000
```

> Если SQL Server установлен локально — `DB_SERVER=localhost` или `DB_SERVER=.\SQLEXPRESS`

### Шаг 3: Запустить сервер

```bash
node server.js
```

Или с автоперезапуском при изменении файлов:

```bash
npm run dev
```

### Шаг 4: Открыть в браузере

```
http://localhost:3000
```

---

## API эндпоинты

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/stats` | Общая статистика платформы |
| GET | `/api/top-listings` | Топ 5 дорогих объявлений |
| GET | `/api/top-users` | Топ 5 по количеству сделок |
| GET | `/api/categories` | Статистика по категориям |
| GET | `/api/quality-stats` | Статистика по качеству скинов |
| GET | `/api/sales-dynamics` | Динамика продаж за 14 дней |
| GET | `/api/rich-users` | Пользователи выше среднего баланса |
| GET | `/api/popular-skins` | Самые популярные скины |
| GET | `/api/users-detail` | Детали по всем пользователям |
| GET | `/api/listings` | Активные объявления (с фильтрами) |

### Параметры фильтрации для `/api/listings`:

```
?quality=Factory New
?minPrice=100
?maxPrice=5000
?search=AK-47
?sort=price_asc | price_desc | wear | name
```

---

## Страницы сайта

| URL | Страница |
|-----|----------|
| `/` | Главная — статистика + топы |
| `/market` | Маркет скинов с фильтрами и поиском |
| `/analytics` | Аналитика с графиками |
| `/users` | Таблица пользователей |

---

## Частые проблемы

### "Login failed" или "Cannot connect"
- Проверь имя сервера в `DB_SERVER` (попробуй `localhost\SQLEXPRESS`)
- Убедись что SQL Server запущен (Services → SQL Server)
- Проверь что SQL Server Authentication включён (если используешь логин/пароль)

### "Invalid object name 'Trades'"
- Убедись что база данных `pr_Maksimenkov_skins` создана и содержит таблицы
- Проверь параметр `DB_DATABASE` в `.env`

### Порт 3000 занят
- Измени `PORT=3001` в `.env`
