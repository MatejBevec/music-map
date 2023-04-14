const fs = require('fs');

function loadIdsSync(dirPath) {
	const data = fs.readFileSync(dirPath + '/graph.json');
	const ids = JSON.parse(data)['tracks'];

	return ids;
}

module.exports = loadIdsSync;
