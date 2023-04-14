const fs = require('fs/promises');

/**
 * Asynchronously reads all images and returns an object mapping each id to correct url.
 * @param {Array<string>} ids ids of images we want to load
 * @param {string} dirPath directory path where images are located
 * @returns {Promise<object>}
 */
async function loadImgs(ids, dirPath) {
	const batch = {};
	const promiseQueue = [];

	// generate all promises (OS spawns multiple reading threads) => non-blocking
	for (let id of ids) {
		const path = dirPath + '/resized_images/' + id + '.jpg';
		let dataUrlPromise = fs.readFile(path, 'base64url');

		promiseQueue.push(dataUrlPromise);
	}

	// wait for all promises to resolve
	const dataUrls = await Promise.all(promiseQueue);

	for (let i = 0; i < ids.length; i++) {
		const id = ids[i];
		const url = dataUrls[i];

		const dataUrl = 'data:image/png;base64,' + url;
		batch[id] = dataUrl;
	}

	return batch;
}

module.exports = loadImgs;
