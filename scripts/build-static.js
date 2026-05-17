const fs = require('fs/promises');
const path = require('path');
const ejs = require('ejs');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

const pages = [
    { view: 'index', output: 'index.html', pageId: 'home', assetBase: '.' },
    { view: 'market', output: 'market/index.html', pageId: 'market', assetBase: '..' },
    { view: 'analytics', output: 'analytics/index.html', pageId: 'analytics', assetBase: '..' },
    { view: 'users', output: 'users/index.html', pageId: 'users', assetBase: '..' },
];

function paths(assetBase) {
    return {
        homePath: `${assetBase}/`,
        marketPath: `${assetBase}/market/`,
        analyticsPath: `${assetBase}/analytics/`,
        usersPath: `${assetBase}/users/`,
    };
}

async function renderPage(page) {
    const input = path.join(root, 'views', `${page.view}.ejs`);
    const output = path.join(dist, page.output);
    const html = await ejs.renderFile(input, {
        staticMode: true,
        pageId: page.pageId,
        assetBase: page.assetBase,
        ...paths(page.assetBase),
    });

    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, html, 'utf8');
}

async function build() {
    await fs.rm(dist, { recursive: true, force: true });
    await fs.mkdir(dist, { recursive: true });
    await fs.cp(path.join(root, 'public'), dist, { recursive: true });
    await fs.writeFile(path.join(dist, '.nojekyll'), '', 'utf8');

    for (const page of pages) {
        await renderPage(page);
    }
}

build().catch(error => {
    console.error(error);
    process.exit(1);
});
