
// ------------------ CLASSES ------------------ 

class DrawablePoint {

    constructor(map, idx, id, info, imgPath, clipPath){
      this.map = map
      this.idx = idx
      this.id = id
      this.info = info
      this.imgPath = imgPath
      this.img = null
      this.clipPath = clipPath
      //this.clip = null
      this.reader = null

      this.genre = null
      this.color = null
      if (USE_GENRE_COLORS){
        console.log(this.map)
        this.genre = this.map.meta.info[this.id]["genre_class"]
        this.color = GENRE_COLORS[this.genre]
      }
    }
  
    loadImgBlob(blob){
          if (this.reader == null){
          this.reader = new FileReader()
          this.reader.onloadend = () => {
            var dataUrl = this.reader.result
            this.loadImg(dataUrl)
          }
        }
        this.reader.readAsDataURL(blob)
    }
  
    loadImg(imgPath){
      if (!USE_IMG) return
      if (imgPath == null) imgPath = this.imgPath
      try{
        loadImage(imgPath, img => {
          this.img = img
        })
      }
      catch (e){}
    }
  
    unloadImg(){
      this.img = null
    }
  
    playClip(){
      if (playingClip && playingClip.isPlaying()){
        playingClip.stop()
      }
      soundFormats('mp3');
      loadSound(this.clipPath, sound => {
        if (sound)
          this.clip = sound
          playingClip = sound
          playingClip.play()
      })
    }
  
    draw(pos, color, circleSize){

      var r, g, b
      if (USE_GENRE_COLORS && this.genre != null)
        [r, g, b] = this.color
      else 
        [r, g, b] = color
      fill(r, g, b)
  
      var size = IMG_SIZE
      if (this.img && USE_IMG){
        image(this.img, pos[0]-size/2, pos[1]-size/2, size, size)

        // if (this.map.selected == this.idx){
        //   var size = IMG_SIZE + IMG_SEL_PAD
        //   rect(pos[0]-size/2, pos[1]-size/2, size, size)
        // }
      
      }
      else{
        strokeWeight(0)
        ellipse(pos[0], pos[1], circleSize, circleSize)
        //text(this.idx, pos[0], pos[1])
        // if (this.map.selected == this.idx)
        //   ellipse(pos[0], pos[1], DOT_SEL_PAD, DOT_SEL_PAD)
      }
  
  
    }
  
  }
  
  class Walk {
  
    constructor(map, indices){
      this.map = map
      this.indices = indices
      this.i = 0
      // BODGE
      this.playerEl = document.getElementById("embed-iframe")
    }
  
    draw() {
      strokeWeight(WALK_STROKE)
      var c = this.map.colors[this.indices[0]]
      stroke(c[0], c[1], c[2])
      noFill()
      beginShape()
      var p = this.map.toScreen(this.map.proj[this.indices[0]])

      curveVertex(p[0], p[1])
      for(var i of this.indices){
        var pGlob = this.map.proj[i]
        p = this.map.toScreen(pGlob)
        curveVertex(p[0], p[1])

      }
      curveVertex(p[0], p[1])

      endShape()

      for(var i of this.indices){
        var pGlob = this.map.proj[i]
        var p = this.map.toScreen(pGlob)
        fill(255)
        if (USE_IMG){
          var size = IMG_SIZE + IMG_SEL_PAD
          rect(p[0]-size/2, p[1]-size/2, size, size)
        }
        else
          ellipse(p[0], p[1], DOT_SEL_PAD, DOT_SEL_PAD)
        noFill()
      }

    }

    moveTo(i){
      i = i % (this.indices.length - 1)
      this.i = (i < 0) ? (this.indices.length - 1) + i : i
      this.map.selectPoint(this.indices[this.i])
      // var p = this.map.proj[this.indices[this.i]]
      // this.map.moveWindow(p, null)
      // this.map.drawables[this.indices[this.i]].playClip()
      return true     
    }
  
    next(){
        this.moveTo(this.i + 1)
    }

    prev(){
        this.moveTo(this.i - 1)
    }
  
    static random(map, query, n, k){
      var q = query
      var walk = [q]
      for (var i = 0; i < n; i++){
        var pick = Math.trunc(Math.random() * k) + 1
        var next = map.findPoint(map.proj[q], pick)
        walk.push(next)
        q = next
      }
      walk = [...new Set(walk)]
      console.log("walk", walk)
      for(var i of walk) console.log(i)
  
      return new Walk(map, walk)
    }
  
    static giro(map, query, controls, dist){
      var angle = Math.PI * 2 // !
      var ratio = width/height
      var q = query
      var origin = map.proj[q]
      // query should be on top of circle:
      origin = [origin[0], origin[1] + dist]
      var walk = [q]
      for (var i = 1; i < controls; i++){
        var ang = angle * i/(controls-1)
        var x = origin[0] + dist * Math.cos(ang - Math.PI/2)
        var y = origin[1] + dist * Math.sin(ang - Math.PI/2)
        var next = map.findPoint([x, y], 1)
        walk.push(next)
      }
      //walk.push(q)
      walk[walk.length-1] = q // !
      console.log("walk", walk)
  
      return new Walk(map, walk)
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
      map.walk = null
      map.selected = null // current selected song
      map.winImgs = []
      map.winSizes = []
      map.imgs = new Array(map.proj.length).fill(null)
      map.topTag = ""


      //OR SHOULD WE INSTANTIATE POINTS ON WINDOW CHANGE?
      var drawables = []
      for (i = 0; i < projections.length; i++){
        var id = metadata.ids[i]
        var imgPath = `${DATA_DIR}/resized_images/${id}.jpg` // TEMP!!!
        var audioPath = `${DATA_DIR}/clips/${id}.mp3` 
        //var img = imgs[i]
        var drawable = new DrawablePoint(map, i, id, metadata.info[id], imgPath, audioPath)
        drawables.push(drawable)
      }
      map.drawables = drawables
  
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
  
      return [kept, sizes]
    }
  
    changeWindow(p0, p1){
      // Called when viewing window changes (zoom or move)
  
      var oldIdxSet = new Set(this.winIdx)
  
      console.log("change window to", p0, p1)
  
      this.p0Lazy = this.p0
      this.p1Lazy = this.p1
      this.moveDone = false
  
      this.p0 = p0
      this.p1 = p1
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
  
      // load new images in batches
      if (USE_IMG){

        for (var i of unloadIdxSet)
          this.drawables[i].unloadImg()

        var newIds = loadIdxSet.map((idx) => this.meta.ids[idx])

        // -- FETCH IMGS ONE BY ONE --
        // for (let idx of loadIdxSet){
        //   console.log("fetching", idx)
        //   fetch(`${DATA_DIR}/resized_images/${this.meta.ids[idx]}.jpg`).then((res) => {
        //     console.log("response recieved for", idx)
        //     var blob = res.blob()
        //   })
        // }
        
        // -- FETCH IMGS AS IN BATCH AS JSON OF DATA URLS --
        fetchImages(newIds, 30).then((dict) => {
          const ids = Object.keys(dict)
          console.log("received: ", ids)
          for (let i = 0; i < ids.length; i++){
            const dataUrl = dict[ids[i]]
            this.drawables[loadIdxSet[i]].loadImg()
          }
        })
      }


      // change current top genre tag
      this.topTag = this.getTopTag("genre_class")
  
    }

    resetWindow(){
      this.winIdx = []
      this.changeWindow(this.p0, this.p1)
    }
  
    moveWindow(midp, delta){
      if (midp == null)
        midp = [this.midp[0] + delta[0], this.midp[1] + delta[1]]
  
      // PRECOMPUTE THIS SOMEWHERE TO OPTIMIZE
      var ww = (this.p1[0] - this.p0[0])/2
      var wh = (this.p1[1] - this.p0[1])/2
  
      var p0 = [midp[0] - ww, midp[1] - wh]
      var p1 = [midp[0] + ww, midp[1] + wh]
      this.changeWindow(p0, p1)
    }
  
    zoomWindow(amount){
      var halfw = (this.p1Lazy[0] - this.p0Lazy[0])/2 * (1+amount)
      var halfh = (this.p1Lazy[1] - this.p0Lazy[1])/2 * (1+amount)
      var ratio = halfh/halfw
      
      // OCCASIONAL BUG HERE!
      if (halfw < MIN_ZOOM){
        halfw = MIN_ZOOM
        halfh = ratio*halfw
      }
      else if (halfw > MAX_ZOOM){
        halfw = MAX_ZOOM
        halfh = ratio*halfw
      }
  
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

    selectPoint(idx){
      var p = this.proj[idx]
      this.moveWindow(p, null)
      //this.drawables[idx].playClip()
      this.selected = idx
      console.log("HELLO", this.selected)
      embedController.loadUri("spotify:track:" + this.meta.ids[idx])
    }
  
    getLabel(idx){
      if (idx){
        var id = this.meta.ids[idx]
        var title = this.meta.info[id]["name"] 
        return title
      }
      else return ""
    }

    getTopTag(attr){
      let tags = []
      let info = this.meta.info
      let ids = this.meta.ids
      for (const i of this.winIdx){
        if (info[ids[i]][attr] instanceof Array)
          tags = tags.concat(info[ids[i]][attr])
        else
          tags.push(info[ids[i]][attr])
      }
      counts = getArrayCounts(tags)
      console.log(counts)
      return Object.keys(counts)[0]
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
      if (this.walk)
        this.walk.draw()
  
      // Points
      var size = 5
      var i
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
        text(label, hoverP[0]+5, hoverP[1])
      }

      // Selected
      if (this.selected){
        fill(255, 0, 0)
        let p = this.proj[this.selected]
        p = this.toScreen(p)
        p[1] -= 10
        triangle(p[0], p[1]-10, p[0]-5, p[1]-20, p[0]+5, p[1]-20)
      }

      // Current top tag
      fill(0, 0, 0)
      text(this.topTag, 32, height-32)
    }
  
  }
  