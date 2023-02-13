
// ------------------ RUNTIME SCRIPT ------------------ 


// -- INIT --

// embedded spotify player
var embedController = null
window.onSpotifyIframeApiReady = (IFrameAPI) => {
  let element = document.getElementById('embed-iframe');
  let options = {
      width: "70%",
      height: "80", //BODGE
      //uri: 'spotify:episode:7makk4oTQel546B0PZlDM5'
    };
  let callback = (EmbedController) => {
    //console.log(element.contentWindow)
    //element.style.height = element.contentWindow.document.body.scrollHeight + 'px';
    console.log("SETTING CONTROLLER")
    embedController = EmbedController
  };
  IFrameAPI.createController(element, options, callback);
};

async function preload() {


}

async function setup() {
  var p5canvas = createCanvas(windowWidth, windowHeight - 80)
  p5canvas.parent("canvas")
  diagonal = Math.sqrt(Math.pow(width, 2), Math.pow(height))

  fileReader = new FileReader()

  // GUI inputs
  document.getElementById("c-left").onclick = (ev) => walkPrev()
  document.getElementById("c-right").onclick = (ev) => walkNext()
  var delBtn = document.getElementById("c-delete")
  delBtn.onclick = (ev) => {
    if (map.walk == null)
      walkMake()
    else
      walkDelete()
      
  } 

  // pinch zoom stuff
  const el = document.getElementById("main");
  document.onpointerdown = pointerDownHandler;
  document.onpointermove = pointerMoveHandler;
  document.onpointerup = pointerUpHandler;
  document.onpointercancel = pointerUpHandler;
  document.onpointerout = pointerUpHandler;
  document.onpointerleave = pointerUpHandler;

  // load paths
  var embPath = `${DATA_DIR}/embeddings.json`
  var projPath = `${DATA_DIR}/embeddings_proj.json`
  var dgramPath = `${DATA_DIR}/embeddings_proj_dgram.json`
  
  // create music map object
  var ids = await fetchJson(`${DATA_DIR}/graph.json`)
  var info = await fetchJson(`${DATA_DIR}/tracks.json`)
  var metadata = {
    ids: ids["tracks"],
    info: info
  }
  map = await MusicMap.build(embPath, projPath, dgramPath, metadata, null)
  //map.moveWindow((0.5,0.5))
  hasLoaded = true

}


// -- DRAW LOOP --

async function draw() {
  if (hasLoaded){ // BODGE
    background(255)
    map.draw()
  }
}


function mouseClicked() {
  // BODGE BODGE BODGE !!!!!!
  if (mouseY < 80) return
  var p = map.toGlobal([mouseX, mouseY])
  var w = map.windowW
  console.log("CLICK HANDLER")
  map.moveWindow(p, null)
}

function touchStarted() {
}

function touchEnded() {
}

function keyPressed(ev) {

  // KEYBOARD MOVEMENT

  var delta = (map.p1[0] - map.p0[0]) * MOVE_AMOUNT

  if (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW || keyCode === UP_ARROW || keyCode === DOWN_ARROW)
    ev.preventDefault()

  if (keyCode === LEFT_ARROW)
    map.moveWindow(null, [-delta, 0])
  else if (keyCode === RIGHT_ARROW)
    map.moveWindow(null, [delta, 0])
  else if (keyCode === UP_ARROW)
    map.moveWindow(null, [0, -delta])
  else if (keyCode === DOWN_ARROW)
    map.moveWindow(null, [0, delta])

  // KEYBOARD SETTINGS

  if (key === "2"){
    map.minDist = Math.min(map.minDist + 0.005, 1)
  }
  else if (key === "1"){
    map.minDist = Math.max(map.minDist - 0.005, 0)
  }
  if (key == "q")
    DEBUG_MODE = !DEBUG_MODE
  if (key == "w")
    USE_IMG = !USE_IMG
  if (key == "a")
    walkMake()
  if (key == "d")
    walkDelete()
  if(key == "x")
    walkNext()
  if(key == "y")
    walkPrev()
}


// -- MOUSE ZOOM --

var wheelAmount = 0
var timeoutId = 0

function mouseWheel(ev) {
  wheelAmount += ev.delta/150
  clearTimeout(timeoutId)

  console.log("scroll")

  timeoutId = setTimeout(() => {
    console.log("SCROLL TIMEOUT HANDLER")
    map.zoomWindow(ZOOM_AMOUNT * wheelAmount)
    console.log("timeout", wheelAmount)
    wheelAmount = 0
  }, 100)

  ev.preventDefault()
}


// -- PINCH ZOOM --

function pointerDownHandler(ev) {
  evCache.push(ev)
  const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId)
  evCache[index] = ev
  ev.preventDefault()
  document.body.style.zoom = 1;
}

function pointerMoveHandler(ev) {
  if (evCache.length === 2) {
    // Calculate the distance between the two pointers
    const curDiff = dist(evCache[0].clientX, evCache[0].clientY, evCache[1].clientX, evCache[1].clientY)

    if (prevDiff > 0) {
      if (curDiff > prevDiff) {
         // The distance between the two pointers has increased
         console.log("Pinch moving OUT -> Zoom in", ev)

      }
      if (curDiff < prevDiff) {
        // The distance between the two pointers has decreased
        console.log("Pinch moving IN -> Zoom out",ev)

      }
      document.body.style.zoom = 1;
    }

    ev.preventDefault()

    // Cache the distance for the next move event
    prevDiff = curDiff;
  }

}

function pointerUpHandler(ev){ 
  removeEvent(ev)
  document.body.style.zoom = 1;
  if (evCache.length < 2 && evCache.length > 0) {
    const zoomAmount = prevDiff/diagonal
    console.log("UP HANDLER")
    map.zoomWindow(zoomAmount)
    prevDiff = -1
  }
  ev.preventDefault()
}

function removeEvent(ev) {
  const index = evCache.findIndex((cachedEv) => cachedEv.pointerId === ev.pointerId)
  evCache.splice(index, 1)
}


// -- WALK (PLAYLIST) NAVIGATION --

function walkNext(){
  if (map.walk)
    map.walk.next()
}

function walkPrev(){
  if (map.walk)
    map.walk.prev()
}

function walkDelete(){
  map.walk = null
  document.getElementById("c-delete").innerHTML = "create" // BODGE
}

function walkMake(){
  var q = map.findPoint(map.midp)
  map.walk = Walk.giro(map, q, 11, 0.04)
  map.walk.moveTo(0)
  document.getElementById("c-delete").innerHTML = "delete" // BODGE
}