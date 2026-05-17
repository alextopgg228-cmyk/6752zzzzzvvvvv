// server.js — главный файл сервера
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка шаблонизатора EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Статические файлы (CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Роуты
const apiRoutes = require('./routes/api');
const pageRoutes = require('./routes/pages');

app.use('/api', apiRoutes);
app.use('/', pageRoutes);

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера', details: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 CS2 Market запущен: http://localhost:${PORT}`);
});
