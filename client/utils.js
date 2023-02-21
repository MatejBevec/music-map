// ------------------ UTILITIES ------------------ 


// CONSTANTS

const IMG_SIZE = 28
const DATA_DIR = "data/small"
const MOVE_AMOUNT = 0.2
const ZOOM_AMOUNT = 0.2
const WINW = 0.1
const WINH = 0.1
const MARGIN = 0.05
const TRANSITION = 1 // tr. time in seconds
const TR_RATIO = 0.1
const TR_THR = 0.0001

const MIN_DIST = 0.04
const ADAPT_MIN_DIST = true
const SCALE_COLLAPSED = true

const MIN_ZOOM = 0.01
const MAX_ZOOM = 0.2

const WALK_STROKE = 2
const IMG_SEL_PAD = 8
const DOT_SEL_PAD = 16

const USE_GENRE_COLORS = true
const GENRE_COLORS = {
  "classical": [187, 235, 255],
  "country": [85, 60, 38],
  "blues": [61, 85, 38],
  "folk": [166, 145, 103],
  "rock": [40, 99, 205],
  "punk": [12, 184, 180],
  "metal": [4, 50, 50],
  "jazz": [255, 197, 226],
  "soul": [217, 57, 137],
  "pop": [240, 58, 58],
  "electronic": [254, 219, 43],
  "hiphop": [107, 201, 72],
  "reggae": [52, 120, 27],
  "latin": [254, 126, 58],
  "other": [0, 0, 0]
}


// GLOBAL VARIABLES

var map = null
var DEBUG_MODE = true
var USE_IMG = false
var playingClip = null
var diagonal = 0
var fileReader
var hasLoaded = false

// Pinch zoom
var evCache = [];
var prevDiff = -1;

 

// HELPER FUNCTIONS

var euclDistSquared = (a, b) => Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2)
var euclDistSquaredArr = (a, b) => Math.pow(a[0]-b[0], 2) + Math.pow(a[1]-b[1], 2)

async function fetchJson(filepath){
  const response = await fetch(filepath);
  const json = await response.json();
  return json
}

function computeTSNE(emb){
  // Compute tSNE to project original embeddings onto 2D map 

  var model = new TSNE({
    dim: 2,
    perplexity: 30.0,
    earlyExaggeration: 4.0,
    learningRate: 100.0,
    nIter: 1000,
    metric: 'euclidean'
  });

  model.init({
    data: emb,
    type: 'dense'
  })

  var [error, iter] = model.run()
  var output = model.getOutputScaled()

  return output

}


class DendroNode{

  constructor(a, b, point, idx){
    if (a == null || b == null){
      this.point = point
      this.idx = idx
      this.mid = point
      this.dist = 0
      this.a = null
      this.b = null
      this.parent = null
    }
    else{
      // TEMP
      this.point = a.point
      this.idx = a.idx
      var midx = (a.point[0] + b.point[0])/2
      var midy = (a.point[1] + b.point[1])/2
      this.mid = [midx, midy]
      this.dist = euclDistSquaredArr(a.point, b.point)
      this.a = a
      this.b = b
      this.a.parent = this
      this.b.parent = this
    }
  }

  toString(){
    return `${this.idx} (${this.point[0]}, ${this.point[1]})`
  }

}

function computeDendrogram(pts){
  // Hierarchical clustering for point collapsing
  // WAY TOO SLOW :(

  var dgram = new Set()
  var leafs = []
  for (i in pts){
    var newNode = new DendroNode(null, null, pts[i], i)
    dgram.add(newNode)
    leafs.push(newNode)
  }


  while (true){
    var entries = Array.from(dgram.values())
    var nearest = []
    for (i in entries){
      var dists = entries.map(e => [e, euclDistSquaredArr(e.point, entries[i].point)])
      var sorted = dists.slice().sort((a, b) => a[1] - b[1])
      nearest.push( {a: entries[i], b: sorted[1][0], dist: sorted[1][1]})
    }
    var nearestPair = nearest.slice().sort((a, b) => a.dist - b.dist)[0]
    var a = nearestPair.a
    var b = nearestPair.b
    console.log("joining: ", a.toString(), " and ", b.toString())

    dgram.delete(a)
    dgram.delete(b)
    var newNode = new DendroNode(a, b, null, null)
    dgram.add(newNode)

    if (dgram.size <= 1)
      break
  }

  return [dgram, leafs]

}


async function computeDendrogramLoad(pts, dgramPath){
  // Load precomputed dendrogram for projected points

  var linkage = await fetchJson(dgramPath)

  var dgram = []
  for (var i = 0; i < pts.length; i++){
    // repr. (leaf) idx, parent, lchild, rchild, dist, cluster size
    var cl = {idx: i, parent: null, l: null, r: null, dist: 0, size: 1}
    dgram.push(cl)
  }

  var n = dgram.length

  for (var i = 0; i < linkage.length; i++){
    var l = Math.trunc(linkage[i][0])
    var r = Math.trunc(linkage[i][1])
    var dist = linkage[i][2]
    var size = Math.trunc(linkage[i][3])
    var idx = dgram[l].idx // TEMP
    var cl = {idx: idx, parent: null, l: l, r: r, dist: dist, size: size}
    dgram.push(cl)
    dgram[l].parent = n + i
    dgram[r].parent = n + i
  }

  return dgram
}

async function fetchImages(ids, batchSize){
  // Load images with [ids] as a batch of data URLs

  console.log("fetching")
  const response = await fetch("images", {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(ids)
  })
  console.log("awaited response")
  const json = await response.json()
  return json
}

function getArrayCounts(arr){
  counts = {}
  for (const el of arr) {
    counts[el] = counts[el] ? counts[el] + 1 : 1
  }
  const sortable = Object.entries(counts).sort((a, b) => b[1] - a[1])
  counts = {}
  for (const pair of sortable){
    counts[pair[0]] = pair[1]
  }
  console.log(counts)
  return counts
}

function clampString(str, n){
  if (str.length > n)
    str = str.substring(0, n) + "..."
  return str
}