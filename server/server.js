const express = require('express');
const fs = require('fs/promises');

const loadIdsSync = require('./helpers/loadIdsSync');
const loadImgs = require('./helpers/loadImgs');

const DATA_DIR = '../client/data/small';

const IDS = loadIdsSync(DATA_DIR);

// INIT

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static('../client'));

express.static.mime.define({ 'text/x-vue': ['vue'] });

// ENDPOINTS

app.get('/', (req, res) => {
	return res.redirect('/index.html');
});

app.get('/images', async (req, res, next) => {
	// TEMP: For testing
	const ids = IDS.slice(0, 100);

	try {
		const batch = await loadImgs(ids, DATA_DIR);

		return res.json(batch);
	} catch (err) {
		return next(err);
	}
});

app.post('/images', async (req, res, next) => {
	// Send the requested batch of images as json of data URLs
	const ids = req.body;

	try {
		const batch = await loadImgs(ids, DATA_DIR);

		return res.json(batch);
	} catch (err) {
		return next(err);
	}
});

app.listen(3000, () => console.log('Listening on port: 3000'));
