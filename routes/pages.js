// routes/pages.js — рендер страниц
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.render('index'));
router.get('/market', (req, res) => res.render('market'));
router.get('/analytics', (req, res) => res.render('analytics'));
router.get('/users', (req, res) => res.render('users'));
router.get('/admin', (req, res) => res.render('admin'));

module.exports = router;
