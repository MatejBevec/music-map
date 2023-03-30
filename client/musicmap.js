
// ------------------ MUSIC MAP CLASS ------------------ 
  
  class MusicMap {
    /**
      Singleton representing the entire music map.
      Holds all data (points and metadata) and logic.
     */
  
    constructor(){   
      // Construction is done in the "build" async method   
    }
  
    static async build(embeddings, projectedPath, dgramPath, landmarksPath, metadata, imgDir){
      // Creates and populates map instance async.
      
      if (typeof embeddings === 'string' || embeddings instanceof String){
        embeddings = await fetchJson(embeddings)
      }
  
      // Load precomputed TSNE projections
      var projections = await fetchJson(projectedPath)
  
      // Init colors (for demonstration)
      // TODO: CLEAN THIS UP!!!
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
  
      // Construct hierarchical dendrogram (for coalescing zoom)
      var dgram = await computeDendrogramLoad(projections, dgramPath)

      // Load subgenre grid pyramid
      var landmarkGrid, landmarkSizes
      [landmarkSizes, landmarkGrid] = await fetchJson(landmarksPath)

  
      // Create and populate the MusicMap object
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
      map.landmarkGrid = landmarkGrid
      map.landmarkSizes = landmarkSizes
      map.landmarkGridView = null

      // Create instances for displayed song nodes
      var drawables = []
      for (i = 0; i < projections.length; i++){
        var id = metadata.ids[i]
        var imgPath = `${DATA_DIR}/resized_images/${id}.jpg` // TEMP!!!
        var audioPath = `${DATA_DIR}/clips/${id}.mp3` 
        //var img = imgs[i]
        var drawable = new DrawablePoint(map, i, id, metadata.info[id], imgPath, audioPath, map.colors[i])
        drawables.push(drawable)
      }
      map.drawables = drawables
      
      // Init view
      map.moveDone = true
      map.changeWindow([0.5-WINW/2, 0.5-WINH/2], [0.5+WINW/2, 0.5+WINH/2])
      map.moveWindow([0.5, 0.5])
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
      // Called when viewed window changes (zoom or move)

      if (p0.includes(NaN) || p1.includes(NaN))
        return
  
      var oldIdxSet = new Set(this.winIdx)
  
      console.log("change window to", p0, p1)
  
      this.p0Lazy = this.p0
      this.p1Lazy = this.p1
      this.moveDone = false
  
      this.p0 = p0
      this.p1 = p1
      this.midp = [(p0[0] + p1[0])/2, (p0[1] + p1[1])/2]
  
      var ww = (this.p1[0] - this.p0[0])
      this.minDist = MIN_DIST * (ww - MIN_ZOOM)
      
      this.winIdxAll = this.pointsInWindow(p0, p1)
      
      // Get coalesced points
      var ret = this.collapsePoints(this.winIdxAll, this.minDist)
      this.winIdx = ret[0]
      this.winSizes = ret[1]
      this.winIdxSet = new Set(this.winIdx)
      
      // Find points to load and unload compared to prev. view
      var loadIdxSet = [...this.winIdxSet].filter(el => !oldIdxSet.has(el))
      var unloadIdxSet = [...oldIdxSet].filter(el => !this.winIdxSet.has(el))
  
      // Load new images in batches
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
          //console.log("received: ", ids)
          for (let i = 0; i < ids.length; i++){
            const dataUrl = dict[ids[i]]
            this.drawables[loadIdxSet[i]].loadImg()
          }
        })
      }


      // Change current top genre tag
      this.topTag = this.getTopTag("genre_class")
      
      // Compute subgenre grid info for current view
      this.landmarkGridView = this.computeGenreGridView()
  
    }

    resetWindow(){
      // Force view refresh without changing it

      this.winIdx = []
      this.changeWindow(this.p0, this.p1)
    }
  
    moveWindow(midp, delta){
      // Move wiew to specific point or by a delta

      if (midp == null)
        midp = [this.midp[0] + delta[0], this.midp[1] + delta[1]]
  
      var ww = (this.p1[0] - this.p0[0])/2
      var wh = (this.p1[1] - this.p0[1])/2
  
      var p0 = [midp[0] - ww, midp[1] - wh]
      var p1 = [midp[0] + ww, midp[1] + wh]
      this.changeWindow(p0, p1)
    }
  
    zoomWindow(amount){
      // Change view size

      var halfw = (this.p1Lazy[0] - this.p0Lazy[0])/2 * (1+amount)
      var halfh = (this.p1Lazy[1] - this.p0Lazy[1])/2 * (1+amount)
      var ratio = halfh/halfw
      
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
      // Find k nearest songs to given location ("point") in projected space

      var pt = this.tree.nearest({x: point[0], y: point[1]}, 100)
      var sorted = pt.sort((a, b) => a[1] - b[1])
      var indices = sorted.map(p => parseInt(p[0].i))
      //var filtered = indices.filter(idx => this.winIdxSet.has(idx))
      var filtered = indices
      if (!k) k = 0
      var idx = filtered[k]
      return idx
    }

    selectPoint(idx){
      // Select song (for playing) by index

      var p = this.proj[idx]
      this.moveWindow(p, null)
      this.selected = idx
      embedController.loadUri("spotify:track:" + this.meta.ids[idx])
    }
  
    getLabel(idx){
      // Get title - artist tag for song by index

      if (idx){
        var id = this.meta.ids[idx]
        var label = []
        label.push(clampString(this.meta.info[id]["name"], 20))
        label.push(this.meta.info[id]["artist"])
        return label
      }
      else return ""
    }

    getTopTag(attr){
      // Get most prevalent genre in current view window
      // TODO: change this

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
      return Object.keys(counts)[0]
    }
  
    toScreen(point){
      // Global [0, 1] coords to screen coords
  
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
      // Screen coords to global [0, 1] coords
  
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

    computeGenreGridView(){
      // Compute current view of the subgenre grid
      // TODO: consider precomputing

      let zoom = this.p1[0] - this.p0[0]
      if (zoom > GENRE_GRID_LEVELS[0])
        return null

      // Determine appropriate detail level
      // TODO: clean this up
      let i
      for (i = 0; i < GENRE_GRID_LEVELS.length; i++)
        if (zoom > GENRE_GRID_LEVELS[i]){
          break
        }
      i -= 1
      let cellSize = this.landmarkSizes[i]
      let subGrid = this.landmarkGrid[i][0]
      let topGrid = this.landmarkGrid[i][1]
      
      // Compute visible cell borders in x and y
      // and which global cell indices (xi, yi) they correspond to
      // BUG: all cells are displayed
      let x = 0.0; let xs = []
      let xi = 0; let xis = []
      while(x < 0.9999999){
        if (xi+cellSize > this.p0[0] || xi < this.p1[0]){
          xs.push(x)
          xis.push(xi)
        }
        x += cellSize
        xi ++
      }
      let y = 0.0; let ys = []
      let yi = 0; let yis = []
      while(y < 0.9999999){
        if (yi+cellSize > this.p0[1] || yi < this.p1[1]){
          ys.push(y)
          yis.push(yi)
        }
        y += cellSize
        yi ++
      }

      print(cellSize, subGrid.length, xis.length)
      let cells = []

      // Populate visible cells with subgenre info
      for (let a = 0; a < xs.length; a++){
        for (let b = 0; b < ys.length; b++){
          let fr = [xs[a], ys[b]]
          let to = [fr[0]+cellSize, fr[1]+cellSize]
          let subgenre = subGrid[xis[a]][yis[b]]
          let genre = topGrid[xis[a]][yis[b]]
          let cell = {from: fr, to: to, 
                  genre: genre, subgenre: subgenre}
          cells.push(cell)
        }
      }

      return cells
    }
  
    draw(){
      // Draw the map at every time step
  
      // Interpolate to new view
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

      // Subgenre grid cells
      if (this.landmarkGridView){
        let cells = this.landmarkGridView
        if (cells != null)
          for (let cell of cells){
            noStroke()
            if (cell.subgenre == "")
              continue
            let clr = GENRE_COLORS[cell.genre]
            fill(clr[0], clr[1], clr[2], 100)
            let to = this.toScreen(cell.to)
            let from = this.toScreen(cell.from)
            let cellW = to[0] - from[0]
            let cellH = to[1] - from[1]
            rect(from[0], from[1], cellW, cellH)
            fill(0, 0, 0)
            textAlign(CENTER)
            text(cell.subgenre, from[0] + cellW/2, from[1] + cellH/2)
            textAlign(LEFT)
          }
      }
  
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
  
      // Points (songs)
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
        // TODO
        this.drawables[i].draw(p, size)
      }
  
      // Label
      if (hoverIdx){
        var label = this.getLabel(hoverIdx)
        var hoverP = this.toScreen(this.proj[hoverIdx])
        let l = hoverP[0] + IMG_SIZE/2 + 10

        textStyle(BOLD)
        textSize(8)
        let awidth = textWidth(label[1])
        textStyle(NORMAL)
        textSize(10)
        let nwidth = textWidth(label[0])
        fill(255, 255, 255)
        rect(l-5, hoverP[1] - 10, Math.max(awidth, nwidth) + 10, 24)
        fill(0, 0, 0)
        text(label[0], l, hoverP[1] + 9)
        textStyle(BOLD)
        textSize(8)
        text(label[1], l, hoverP[1] - 1)

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
  