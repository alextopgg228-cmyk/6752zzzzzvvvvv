# Deploy на GitHub Pages

Проект теперь умеет собираться в статический сайт для GitHub Pages.

Важно: GitHub Pages не запускает Node.js, Express и SQL Server. Поэтому на GitHub Pages сайт работает в demo mode: страницы, фильтры, таблицы и графики открываются, а данные берутся из `public/data/api.json`. Для настоящей базы и покупок нужен Node-хостинг отдельно.

## Как залить

1. Создай пустой репозиторий на GitHub без README.
2. Выполни в PowerShell:

```powershell
cd "C:\Users\User\Desktop\ль"
git config --global user.name "YOUR_NAME"
git config --global user.email "YOUR_EMAIL"
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3. На GitHub открой репозиторий:

- Settings
- Pages
- Source: GitHub Actions

После push GitHub Actions сам соберет сайт командой `npm run build:pages` и опубликует его на GitHub Pages.

## Проверить локально

```powershell
cd "C:\Users\User\Desktop\ль"
npm run build:pages
npx serve dist
```

## Реальный backend

Локально Express-версия осталась:

```powershell
npm start
```

Для сайта с реальной SQL Server базой используй Render, Railway, Fly.io, Azure App Service или VPS. В GitHub Pages backend не работает.
