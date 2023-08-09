// ------------------ UTILITIES ------------------ 


// CONSTANTS

var IMG_SIZE = 28                         // album cover image size
var DATA_DIR = "data/medium"              // dataset directory
var MOVE_AMOUNT = 0.2                     // amount (in global) to move with single arrow key press
var ZOOM_AMOUNT = 0.2                     // amount (in global) to move with single mouse scroll
var WINW = 0.1                            // initial viewing window width (in global)
var WINH = 0.1                            // initial viewing window height (in global)
var MARGIN = 0.25    //0.25                     // buffer/loading margin around window (in % of WINW)   
var TR_RATIO = 0.1                        // interpolaton factor per frame for the exponential transition anim.
var TR_THR = 0.0001                       // end transition when difference is smaller than this

var MIN_DIST = 0.16  //0.04                      // distance (in % of WINW) under which to collapse multiple points into one
var ADAPT_MIN_DIST = true                 // collapsing distance is relative to WINH
var SCALE_COLLAPSED = true                // show collapsed points as bigger blobs (proportional to # of points)
var BLOB_SIZE_FACTOR = 5                  // collapsed blob size will be this times # number of points
var BLOB_SIZE_MAX = 50                    // cap larger blobs to this size (for visual clarity)

var MIN_ZOOM = 0.005   //0.01                    // smallest allowed window (most zoomed in, in global)
var MAX_ZOOM = 0.8     //0.5                    // largest allowed window (most zoomed out, in global)
var LABELS_ZOOM = 0.02  //0.03                   // window size when song info (artist, title) become visible (in global)

var WALK_STROKE = 2                       // stroke width for line connecting songs on walk/playlist           
var IMG_SEL_PAD = 8                       // stroke width for border around selected song's album cover
var DOT_SEL_PAD = 16                      // stroke width for border around selected song's dot (when without imgs)

var HOVER_DIST = 0.03                     // radius of a point, i.e. distance under which a click selects the song
var WALK_DENSITY = 10                     // how many songs to fit to a walk
                                            // i.e. if walk spans entire window, appr. WALK_DENSITY songs will be selected
var JOURNEY_DENSITY = 0.12                // modifier for from-to walk
var RELATIVE_JOURNEY_DENSITY = false      // if true, number of songs in instead global

var USE_GENRE_COLORS = true               // color blobs and subgenre regions by top-level genre
var GENRE_COLORS = {                      // top-level genre colors
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

var GENRE_GRID_LEVELS = [0.4, 0.2, 0.1]   // zooms levels where the 3 LOD of the subgenre grid are shown

var TOP_LEVEL_TAGS = [                    // manual descriptive tags for top-level clusters
  [0.2, 0.63, "Hip Hop 🎤"],
  [0.19, 0.34, "Pop 🎵"],
  [0.11, 0.08, "Rock 🎸"],
  [0.4, 0.35, "Electronic 🤖"],
  [0.65, 0.1, "Latin 💃🏻"],
  [0.77, 0.5, "Latin (Brazil) 💚"],
  [0.95, 0.35, "Latin (Mexico) 🪅"],
  [0.48, 0.7, "K-pop 🎶"],
  [0.41, 0.9, "Pop (India) 🐯"],
  [0.36, 0.17, "Christmas pop 🎅🏻"],
  [0.28, 0.41, "Country 🤠"],
  [0.075, 0.22, "Metal ☠︎︎"]

]

// GLOBAL VARIABLES

var map = null                              // the instance for entire map object
var DEBUG_MODE = false                      // if true zoom out and show viewing window in frame
var USE_IMG = false                         // true to show album covers, false to show colored blobs
var playingClip = null                      // currently playing song file [OBSOLETE]
var diagonal = 0                            // the diagonal length of the current viewing window
var fileReader                              // OBSOLETE?
var hasLoaded = false                       // true when dataset has loaded and is ready to display

// PINCH ZOOM STUFF [TODO]

var evCache = [];
var prevDiff = -1;

 

// HELPER FUNCTIONS

const euclDist = (a, b) => Math.sqrt(Math.pow(a[0]-b[0], 2) + Math.pow(a[1]-b[1], 2))
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
    //console.log("joining: ", a.toString(), " and ", b.toString())

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

  //console.log("fetching")
  const response = await fetch("images", {
    method: 'POST',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({data_dir: DATA_DIR, ids: ids})
  })
  //console.log("awaited response")
  console.log(response)
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
  //console.log(counts)
  return counts
}

function clampString(str, n){
  if (str.length > n)
    str = str.substring(0, n) + "..."
  return str
}

function sortIndex(arr){
  let arr_index = []
  for (let i in arr) arr_index.push([i, arr[i]])
  arr_index.sort((a, b) => a[1] < b[1] ? -1 : 1)
  let sorted_index = []
  let sorted = []
  for (let i in arr){
    sorted_index.push(arr_index[i][0])
    sorted.push(arr_index[i][1])
  }

  return [sorted, sorted_index]

}

function setIntersection(a, b){
  let intersection = new Set([...a].filter(x => b.has(x)));
  return intersection
}

function getGenreColor(map, idx){
  let id = map.meta.ids[idx] 
  let genre = map.meta.info[id]["genre_class"]
  if (genre != null){
    let color = GENRE_COLORS[genre]
    return color
  }
  else return [0, 0, 0]
}