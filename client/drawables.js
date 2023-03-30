// ------------------ DRAWABLE OBJECT CLASSES ------------------ 


class DrawablePoint {
    /**
     Represents a song "node" displayed on the map.
     */

    constructor(map, idx, id, info, imgPath, clipPath, color){
      this.map = map
      this.idx = idx
      this.id = id
      this.info = info
      this.imgPath = imgPath
      this.img = null
      this.clipPath = clipPath
      this.clip = null
      this.reader = null
      this.genre = null
      this.color = color

      // TODO: using globals here is a bit sketchy
      if (USE_GENRE_COLORS){
        this.genre = this.map.meta.info[this.id]["genre_class"]
        if (this.genre != null)
          this.color = GENRE_COLORS[this.genre]
      }
    }
  
    loadImgBlob(blob){
      // Load own image from given binary blob (data url)

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
      // Load own image from given or stored url/path

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
      // (OBSOLETE) Play 30s preview clip for this song

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
  
    draw(pos, circleSize){
      // Draw sphere or album cover for this song node (depending on setting)

      var r, g, b
      [r, g, b] = this.color
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
    /**
      Represents a playlist, i.e. a sequence of songs on the map.
     */
  
    constructor(map, indices){
      this.map = map
      this.indices = indices
      this.i = 0
      this.playerEl = document.getElementById("embed-iframe")      // BODGE
    }
  
    draw() {
      // Draw lines connecting the song sequence (called when walk is active)
      // TODO: handle color

      strokeWeight(WALK_STROKE)
      var c = this.map.colors[this.indices[0]]
      stroke(c[0], c[1], c[2])
      noFill()
      beginShape()
      var p = this.map.toScreen(this.map.proj[this.indices[0]])

      // Draw connecting curve
      curveVertex(p[0], p[1])
      for(var i of this.indices){
        var pGlob = this.map.proj[i]
        p = this.map.toScreen(pGlob)
        curveVertex(p[0], p[1])

      }
      curveVertex(p[0], p[1])
      endShape()

      // Draw outlines around included songs
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
      // Select i-th song in this walk on the map

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
      // Factory: build walk with random songs in k-neighborhood around query

      var q = query
      var walk = [q]
      for (var i = 0; i < n; i++){
        var pick = Math.trunc(Math.random() * k) + 1
        var next = map.findPoint(map.proj[q], pick)
        walk.push(next)
        q = next
      }
      walk = [...new Set(walk)]
      for(var i of walk) console.log(i)
  
      return new Walk(map, walk)
    }
  
    static giro(map, query, controls, dist){
      // Factory: build walk in a circle starting at ending at query

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
      walk[walk.length-1] = q // !
  
      return new Walk(map, walk)
    }
  
  }
  