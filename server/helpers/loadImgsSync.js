function loadImgsSync(ids) {
	const batch = {};

	for (let id of ids) {
		console.log(id);
		const path = DATA_DIR + '/resized_images/' + id + '.jpg';
		let dataUrl = fs.readFileSync(path, 'base64url');

		dataUrl = 'data:image/png;base64,' + dataUrl;
		batch[id] = dataUrl;
	}

	return batch;
}

module.exports = loadImgsSync;
