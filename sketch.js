
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

const MIN_DIST = 0.02
const ADAPT_MIN_DIST = true
const SCALE_COLLAPSED = true

const MIN_ZOOM = 0.01
const MAX_ZOOM = 0.2



// GLOBAL VARIABLES

var map = null
var DEBUG_MODE = true
var USE_IMG = false

 

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

  console.log(model)
  console.log(emb)

  model.init({
    data: emb,
    type: 'dense'
  })

  var [error, iter] = model.run()
  var output = model.getOutputScaled()

  console.log(output)

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
    //console.log(entries)
    var nearest = []
    for (i in entries){
      console.log(i)
      var dists = entries.map(e => [e, euclDistSquaredArr(e.point, entries[i].point)])
      var sorted = dists.slice().sort((a, b) => a[1] - b[1])
      nearest.push( {a: entries[i], b: sorted[1][0], dist: sorted[1][1]})
    }
    var nearestPair = nearest.slice().sort((a, b) => a.dist - b.dist)[0]
    //console.log(nearestPair)
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

  console.log(linkage.length)

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


// CLASSES

class DrawablePoint {

  constructor(idx, id, info, imgPath, img){
    this.idx = idx
    this.id = id
    this.info = info
    this.imgPath = imgPath
    this.img = img
  }

  loadImg(){
    if (!USE_IMG) return
    try{
      loadImage(this.imgPath, img => {
        this.img = img
      })
    }
    catch (e){}
  }

  unloadImg(){
    this.img = null
  }

  draw(pos, color, circleSize){

    var size = IMG_SIZE
    if (this.img && USE_IMG){
      image(this.img, pos[0]-size/2, pos[1]-size/2, size, size)
    }
    else{
      strokeWeight(0)
      var r, g, b
      [r, g, b] = color
      fill(r, g, b)
      ellipse(pos[0], pos[1], circleSize, circleSize)
    }


  }

}

class Walk {

  constructor(indices){

  }



}


class MusicMap {
  // Holds all data (points) and logic

  constructor(){      
  }

  static async build(embeddings, projectedPath, dgramPath, metadata, imgDir){
    
    if (typeof embeddings === 'string' || embeddings instanceof String){
      print(embeddings)
      embeddings = await fetchJson(embeddings)
    }

    // TODO: server-side precompute and save

    // this.projPath = projectedPath
    // var res = await fetch(this.projPath)

    // if (!res.ok){
    //   newProj = computeTSNE(this.emb)
    //   str = JSON.stringify(newProj)
    // }
    // this.proj = await res.json()

    // var projections = computeTSNE(embeddings)

    // TEMP: Load precomputed TSNE projections
    var projections = await fetchJson(projectedPath)

    //OR SHOULD WE INSTANTIATE POINTS ON WINDOW CHANGE?
    var drawables = []
    for (i = 0; i < projections.length; i++){
      var id = metadata.ids[i]
      var imgPath = `${DATA_DIR}/resized_images/${id}.jpg` // TEMP!!!
      //var img = imgs[i]
      var drawable = new DrawablePoint(i, id, metadata.info[id], imgPath, null)
      drawables.push(drawable)
    }


    // Init colors (for demonstration)
    var colors = []
    for (var i = 0; i < projections.length; i++){
      var r = Math.trunc(projections[i][0]*255)
      var g = Math.trunc(Math.random()*255)
      var b = Math.trunc(projections[i][1]*255)
      colors.push([r, g, b])
    }

    // Construct KD tree (for lookup)
    var kdPts = []
    for (var i in projections){
      var p = projections[i]
      kdPts.push({x: p[0], y: p[1], i:i})
    }
    var tree = new kdTree(kdPts.slice(), euclDistSquared, ["x", "y"])

    // Construct hierarchical dendrogram (for min. dist. collapsing)
    var dgram = await computeDendrogramLoad(projections, dgramPath)

    // Create and the MusicMap object
    var map = new MusicMap()
    map.emb = embeddings
    map.proj = projections
    map.winPoints = map.proj
    map.winIdx = []
    map.tree = tree
    map.colors = colors
    map.margin = MARGIN
    map.dgram = dgram
    map.minDist = MIN_DIST
    map.meta = metadata
    map.windowW = WINW
    map.windowH = WINH
    map.drawables = drawables
    //map.imgs = imgs
    map.walk = null
    map.winImgs = []
    map.winSizes = []

    console.log(map.meta)

    map.p0 = 0.5
    map.p1 = 0.5
    map.moveDone = true
    map.changeWindow([0.5-WINW/2, 0.5-WINH/2], [0.5+WINW/2, 0.5+WINH/2])
    return map

  }

  pointsInWindow(p0, p1){
    // Return points in given window (possibly with a margin)

    var halfx = (p0[0] + p1[0])/2
    var halfy = (p0[1] + p1[1])/2
    var midpoint = {x: halfx, y: halfy}
    var winP = this.tree.nearest(midpoint, 2000, Math.max(halfx, halfy))

    var mar = this.margin
    var inXRange = p => p[0].x > p0[0]-mar && p[0].x < p1[0]+mar
    var inYRange = p => p[0].y > p0[1]-mar && p[0].y < p1[1]+mar
    winP = winP.filter(p => inXRange(p) && inYRange(p))

    var winIdx = winP.map(p => parseInt(p[0].i)) // Best I can think of
    //var winPoints = winP.map(p => [p[0].x, p[0].y])

    return winIdx

  }

  collapsePoints(winIdx, minDist){
    // Collapse points closer than minDist to a single point

    var kept = new Set()
    var clusters = {}
    for (var idx of winIdx){
      var i = idx
      while (true){
        var parent = this.dgram[i].parent
        if (this.dgram[parent].dist > minDist){
          var left = this.dgram[parent].l
          var lpoint = this.dgram[left].idx
          kept.add(lpoint)
          clusters[lpoint] = left
          var right = this.dgram[parent].r
          var rpoint = this.dgram[right].idx
          kept.add(rpoint)
          clusters[rpoint] = right
          break
        }
        i = parent
      }
    }
    
    var kept = Array.from(kept)
    var sizes = kept.map(i => this.dgram[clusters[i]].size)
    console.log(sizes)

    return [kept, sizes]
  }

  changeWindow(p0, p1){
    // Called when viewing window changes (zoom or move)

    var oldIdxSet = new Set(this.winIdx)

    console.log(p0, p1)

    this.p0Lazy = this.p0
    this.p1Lazy = this.p1
    this.moveDone = false

    this.p0 = p0
    this.p1 = p1
    //this.midp = [(xrange[0] + xrange[1])/2, (yrange[0] + yrange[1])/2]
    this.midp = [(p0[0] + p1[0])/2, (p0[1] + p1[1])/2]

    var ww = (this.p1[0] - this.p0[0])
    this.minDist = MIN_DIST * ww
    
    this.winIdxAll = this.pointsInWindow(p0, p1)

    var ret = this.collapsePoints(this.winIdxAll, this.minDist)
    this.winIdx = ret[0]
    this.winSizes = ret[1]
    this.winIdxSet = new Set(this.winIdx)

    var loadIdxSet = [...this.winIdxSet].filter(el => !oldIdxSet.has(el))
    var unloadIdxSet = [...oldIdxSet].filter(el => !this.winIdxSet.has(el))
    console.log(loadIdxSet)
    for (var i of loadIdxSet)
      this.drawables[i].loadImg()
    for (var i of unloadIdxSet)
      this.drawables[i].unloadImg()


    // var imgs = []
    // for (var i = 0; i < projections.length; i++){
    //   var id = metadata.ids[i]
    //   var imgPath = `${DATA_DIR}/resized_images/${id}.jpg`
    //   var image = null
    //   try{
    //     loadImage(imgPath, img => {
    //       image = img
    //     })
    //   } catch (e){}
    //   imgs[i] = image
    // }


    //this.winPoints = this.proj.filter((i,p) => )
  }

  moveWindow(midp, delta){
    if (midp == null)
      midp = [this.midp[0] + delta[0], this.midp[1] + delta[1]]

    // PRECOMPUTE THIS SOMEWHERE TO OPTIMIZE
    var ww = (this.p1[0] - this.p0[0])/2
    var wh = (this.p1[1] - this.p0[1])/2

    console.log(midp[0], midp[1], ww, wh)

    var p0 = [midp[0] - ww, midp[1] - wh]
    var p1 = [midp[0] + ww, midp[1] + wh]
    this.changeWindow(p0, p1)
  }

  zoomWindow(amount){
    var halfw = (this.p1Lazy[0] - this.p0Lazy[0])/2 * (1+amount)
    var halfh = (this.p1Lazy[1] - this.p0Lazy[1])/2 * (1+amount)

    if (halfw < MIN_ZOOM || halfw > MAX_ZOOM)
      return

    var p0 = [this.midp[0] - halfw, this.midp[1] - halfh]
    var p1 = [this.midp[0] + halfw, this.midp[1] + halfh]
    this.changeWindow(p0, p1)
  }

  findPoint(point, k){
    var pt = this.tree.nearest({x: point[0], y: point[1]}, 100)
    var sorted = pt.sort((a, b) => a[1] - b[1])
    var indices = sorted.map(p => parseInt(p[0].i))
    var filtered = indices.filter(idx => this.winIdxSet.has(idx))
    if (!k) k = 0
    var idx = filtered[k]
    return idx
  }

  getLabel(idx){
    if (idx){
      var id = this.meta.ids[idx]
      var title = this.meta.info[id]["name"] 
      return title
    }
    else return ""
  }

  toScreen(point){
    // Global (0, 1) coords to screen coords

    if (DEBUG_MODE){
      var x = point[0] * width
      var y = point[1] * height
    }
    else{
      var ww = this.p1Lazy[0] - this.p0Lazy[0]
      var wh = this.p1Lazy[1] - this.p0Lazy[1]
      var x = (point[0] - this.p0Lazy[0])/ww * width
      var y = (point[1] - this.p0Lazy[1])/wh * height
    }
    return [x, y]
  }

  toGlobal(point){
    // Screen coords to global (0, 1) coords

    if (DEBUG_MODE){
      var x = point[0] / width
      var y = point[1] / height
    }
    else{
      var ww = (this.p1[0] - this.p0[0])
      var wh = (this.p1[1] - this.p0[1])
      var x = point[0]/width * ww + this.p0Lazy[0]
      var y = point[1]/height * wh + this.p0Lazy[1]
    }
    return [x, y]
  }

  makeWalk(query, n, k){
    var q = query
    var walk = [q]
    for (var i = 0; i < n; i++){
      var pick = Math.trunc(Math.random() * k) + 1
      var next = this.findPoint(this.proj[q], pick)
      walk.push(next)
      q = next
    }
    walk = [...new Set(walk)]
    return walk
  }

  draw(){
    // Draw points every step

    // Interpolate to new point
    if (!this.moveDone){
      var p0Delta = [this.p0[0] - this.p0Lazy[0], this.p0[1] - this.p0Lazy[1]]
      var p1Delta = [this.p1[0] - this.p1Lazy[0], this.p1[1] - this.p1Lazy[1]]
      this.p0Lazy = [this.p0Lazy[0] + TR_RATIO*p0Delta[0], this.p0Lazy[1] + TR_RATIO*p0Delta[1]]
      this.p1Lazy = [this.p1Lazy[0] + TR_RATIO*p1Delta[0], this.p1Lazy[1] + TR_RATIO*p1Delta[1]]
      if (Math.abs(p0Delta[0]) < TR_THR && Math.abs(p0Delta[1]) < TR_THR){
        this.p0Lazy = this.p0
        this.p1Lazy = this.p1
        this.moveDone = true
      }
    }

    var p0 = this.toScreen(this.p0)
    var p1 = this.toScreen(this.p1)
    var p0Lazy = this.toScreen(this.p0Lazy)
    var p1Lazy = this.toScreen(this.p1Lazy)
    var midp = this.toScreen(this.midp)
    var w = p1[0] - p0[0]
    var h = p1[1] - p0[1]
    var wLazy = p1Lazy[0] - p0Lazy[0]
    var hLazy= p1Lazy[1] - p0Lazy[1]
    //var margin = this.margin * Math.max(width, height)
    var margin = this.toScreen([this.margin, this.margin])[0] //HACK

    var mouseP = this.toGlobal([mouseX, mouseY])
    var hoverIdx = this.findPoint(mouseP)

    // Window center and borders
    strokeWeight(1)
    stroke(255, 0, 0)
    noFill()
    ellipse(midp[0], midp[1], 15, 15)
    if (DEBUG_MODE){
      strokeWeight(1)
      stroke(100)
      noFill()
      rect(p0Lazy[0], p0Lazy[1], wLazy, hLazy)
      stroke(200)
      rect(p0Lazy[0]-margin, p0Lazy[1]-margin, wLazy+2*margin, hLazy+2*margin)
    }

    // Walk
    if (this.walk){
      strokeWeight(2)
      var c = this.colors[hoverIdx]
      stroke(c[0], c[1], c[2])
      noFill()
      beginShape()
      for(var i of this.walk){
        var pGlob = this.proj[i]
        var p = this.toScreen(pGlob)
        curveVertex(p[0], p[1])
      }
      endShape()
    }

    // Points
    var size = 5
    var i
    //for(var i of this.winIdx){
    for (var wi = 0; wi < this.winIdx.length; wi++){
      i = this.winIdx[wi]
      strokeWeight(0)
      var pGlob = this.proj[i]
      var p = this.toScreen(pGlob)
      // var r, g, b
      // [r, g, b] = this.colors[i]
      //fill(r, g, b)
      //ellipse(p[0], p[1], 5, 5)
      if (SCALE_COLLAPSED) size = Math.sqrt(this.winSizes[wi]) * 5

      this.drawables[i].draw(p, this.colors[i], size)
    }

    // Label
    if (hoverIdx){
      var label = this.getLabel(hoverIdx)
      var hoverP = this.toScreen(this.proj[hoverIdx])
      //console.log(hoverP, label)
      text(label, hoverP[0]+5, hoverP[1])
    }
  }

}


async function preload() {

}

async function setup() {
  createCanvas(windowWidth, windowHeight)

  // pts = [
  //   [1, 3],
  //   [2, 5],
  //   [10, 0],
  //   [0, 0],
  //   [-1, -1],
  //   [-2, -5],
  //   [-20, 0],
  //   [1, 0]
  // ]

  var embPath = `${DATA_DIR}/embeddings.json`
  var projPath = `${DATA_DIR}/embeddings_proj.json`
  var dgramPath = `${DATA_DIR}/embeddings_proj_dgram.json`
  
  var ids = await fetchJson(`${DATA_DIR}/graph.json`)
  var info = await fetchJson(`${DATA_DIR}/tracks.json`)
  var metadata = {
    ids: ids["tracks"],
    info: info
  }
  map = await MusicMap.build(embPath, projPath, dgramPath, metadata, null)

}

async function draw() {
  background(255)
  //g.draw()
  map.draw()
}

function mouseClicked() {
  //g.onClick()
  var p = map.toGlobal([mouseX, mouseY])
  var w = map.windowW
  //map.changeWindow([p[0]-w, p[1]-w], [p[0]+w, p[1]+w])

  map.moveWindow(p, null)
  //map.draw()
}

function touchStarted() {

  //HACK
  // if (mouseOverHelp)
  //   return
  // g.onTouchStart()
}

function touchEnded() {
  // g.onTouchEnd()
}

function keyPressed() {
  if (key === "2"){
    map.minDist = Math.min(map.minDist + 0.005, 1)
  }
  else if (key === "1"){
    map.minDist = Math.max(map.minDist - 0.005, 0)
  }

  var delta = (map.p1[0] - map.p0[0]) * MOVE_AMOUNT

  if (keyCode === LEFT_ARROW)
    map.moveWindow(null, [-delta, 0])
  else if (keyCode === RIGHT_ARROW)
    map.moveWindow(null, [delta, 0])
  else if (keyCode === UP_ARROW)
    map.moveWindow(null, [0, -delta])
  else if (keyCode === DOWN_ARROW)
    map.moveWindow(null, [0, delta])

  if (key == "q")
    DEBUG_MODE = !DEBUG_MODE

  if (key == "w")
    USE_IMG = !USE_IMG

  if (key == "a"){
    var q = map.findPoint(map.midp)
    var walk = map.makeWalk(q, 25, 4)
    map.walk = walk
  }
  if (key == "s"){
    var q = map.findPoint(map.midp)
    var walk = map.makeWalk(q, 20, 12)
    map.walk = walk
  }
  if (key == "d"){
    map.walk = null
  }

}

function mouseWheel(event) {
  console.log(event.delta)

  map.zoomWindow(ZOOM_AMOUNT * event.delta/150)
}

function keyReleased() {
  // showAllInfo = false
}