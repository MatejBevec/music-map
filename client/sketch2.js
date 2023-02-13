
// CONSTANTS

const IMG_SIZE = 32
const BASE_MASS = 1.5
const REMOVE_EDGES = 0.6
const DATA_DIR = "spotify-graph-explorer/data"

const PLAY_X = 10
const PLAY_Y = 30
const PLAY_R = 16


// GLOBAL VARIABLES

var numHops = 2
var showAllInfo = false
var playingClip = null

var noNodes = 100;
var noConn = 50;
var gravityConstant = 1.1;
var forceConstant = 1000;
var physics = true;
var lerpValue = 0.2;
var startDisMultiplier = 10;



function trimStr(str, len){
  // Trims string to "len" if longer

  if (str.length > len){
    str = str.substring(0, len)
    str = str.concat("", " ...")
  }
  return str
}


function randomPosInCircle(pos, r){
  // Returns a random position in an "r" radius around point "pos"

  let angle = Math.random()*2*Math.PI
  let x = Math.cos(angle)*r
  let y = Math.sin(angle)*r

  return createVector(pos.x+x, pos.y+y)
}


class Node {
  // Represents a drawable, force directed node in the graph

  constructor(){
    this.pos = createVector(0, 0)
    this.vel = createVector(0, 0)
    this.force = createVector(0, 0)
    this.mass = BASE_MASS
  }

  update() {
    let force = this.force.copy()
    let vel = force.copy().div(this.mass)
    //console.log(force)
    this.pos.add(vel)
  }

  showInfo(){
    // Extra information (title) to draw in "hover mode"

    fill(255)
    textSize(14)
    textAlign(CENTER)
    let txt = trimStr(this.title, 30)
    let w = textWidth(txt)
    noStroke()
    fill(255)
    rect(this.pos.x-w/2, this.pos.y+5, w, 20)
    fill(50, 50, 50, 255)
    text(txt, this.pos.x, this.pos.y+20)
  }


}

class SongNode extends Node {
  // A square node representing a song

  constructor(index, id, info, initX, initY, image){
    super()
    this.pos = createVector(initX, initY)
    this.info = info //song metadata from tracks.json
    this.title = info["name"]
    this.artist = info["artist"]
    //this.album = info["album"]
    this.index = index //what index does this object have in Graph
    this.id = id //id in jsons
    this.img = image
    this.hover = false
    this.clip = null
  }

  loadImg(){
    let imgPath = `${DATA_DIR}/resized_images/${this.id}.jpg`

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


  draw(){
    stroke(0)
    fill(255)

    let size = 32
    if(this.clip && this.clip.isPlaying()){
      size = 32 * (1 - 0.3*Math.sin(2 * millis()/1000))
    }

    if (this.img)
      image(this.img, this.pos.x-size/2, this.pos.y-size/2, size, size)
    else
      rect(this.pos.x-size/2, this.pos.y-size/2, size, size)
  }

  mouseOverPlay(){
    let xr = mouseX > this.pos.x-PLAY_X*2-5 && mouseX < this.pos.x
    let yr = mouseY < this.pos.y-10 && mouseY > this.pos.y-2*PLAY_Y
    return xr && yr
  }

  mouseOverLink(){
    let xr = mouseX > this.pos.x && mouseX < this.pos.x+PLAY_X*2+5
    let yr = mouseY < this.pos.y-10 && mouseY > this.pos.y-2*PLAY_Y
    return xr && yr
  }

  showInfo(){
    super.showInfo()
    
    // Show play and link icons if user hovers on top of the node
    if (this.mouseOverPlay() || this.mouseOverLink()) {
      cursor(HAND)

      // link btn
      fill(0)
      image(linkIcon, this.pos.x+PLAY_X-8, this.pos.y-PLAY_Y-8, PLAY_R*0.9, PLAY_R*0.9)

      // play btn
      fill(0)
      image(playIcon, this.pos.x-PLAY_X-8, this.pos.y-PLAY_Y-8, PLAY_R*0.9, PLAY_R*0.9)
    }
    else{
      cursor(ARROW)
    }

  }

  playClip(){
    if (playingClip && playingClip.isPlaying()){
      playingClip.stop()
    }
    soundFormats('mp3');
    loadSound(`${DATA_DIR}/clips/${this.id}.mp3`, sound => {
      if (sound)
        this.clip = sound
        playingClip = sound
        playingClip.play()
    })
  }

  openLink(){
    let url = `https://open.spotify.com/track/${this.id}`
    window.open(url, '_blank').focus();
  }



}

class PlaylistNode extends Node {
  // A round node representing a playlist

  constructor(index, id, info, initX, initY){
    super()
    this.pos = createVector(initX, initY)
    this.info = info //playlist metadata from collections.json
    this.title = info["name"]
    this.index = index //what index does this object have in Graph
    this.id = id //id in jsons
    this.size = 10 + this.info["num_tracks"]
    this.hover = false
  }

  draw(){
    stroke(0)
    fill(255)
    ellipse(this.pos.x, this.pos.y, this.size, this.size)
  }




}

class Graph {
  // Represents the force directed playlist-song graph

  constructor(graphJson, songsJson, playlistsJson, images) {

    this.hops = numHops // how many hops to display (2 = adjacent playlists and songs in those playlists)

    this.nodes = [] // (objects)
    this.songs = [] // (indices)
    this.playlists = [] // (indices)
    this.edges = []
    this.adjList = []
    this.viewedNode = 0
    this.activeNodes = [] // currently shown edges (indices)
    this.activeSongs = []
    this.activePlaylists = []
    this.activeEdges = []
    
    this.clicked = false
    this.lerpValue = lerpValue
    this.hoverNode = 0


    // LOAD THE DATA

    this.idToIdx = {}
    for (let i = 0; i < graphJson["tracks"].length; i++){
      let id = graphJson["tracks"][i]
      this.idToIdx[id] = i
      this.songs.push(i)
    }
    for (let i = this.songs.length; i < this.songs.length + graphJson["collections"].length; i++){
      let id = graphJson["collections"][i-this.songs.length]
      this.idToIdx[id] = i
      this.playlists.push(i)
    }

    this.n = this.songs.length + this.playlists.length


    // populate this.edges
    for (let i = 0; i < graphJson["edges"].length; i+=2){ //skip every other edge to remove bidir.
      let e = graphJson["edges"][i]

      let from = this.idToIdx[e["from"]]
      let to = this.idToIdx[e["to"]]
      let maxDist = 20
      if (Math.random() > REMOVE_EDGES)
        this.edges.push([from, to, maxDist]) // the last entry is length - leave at 1 for now
    }

    // build this.adjList
    for (let i = 0; i < this.n; i++)
      this.adjList.push([])
    for (let i = 0; i < this.edges.length; i++){
      let e = this.edges[i]
      this.adjList[e[0]].push(e[1])
      this.adjList[e[1]].push(e[0])
    }


    // create drawable Node objects
    for (const id in this.idToIdx){
      let i = this.idToIdx[id]
      
      if (i < this.songs.length) {
        let node = new SongNode(i, id, songsJson[id], height/2, width/2, null)
        this.nodes.push(node)
      }
      else{
        let node = new PlaylistNode(i, id, playlistsJson[id], height/2, width/2)
        this.nodes.push(node)
      }
    }

    this.changeFocus(this.hoverNode)

  }

  draw() {

    //draw edges
    stroke(0)
    for (const e of this.activeEdges){
      let from = this.nodes[e[0]]
      let to = this.nodes[e[1]]
      line(from.pos.x, from.pos.y, to.pos.x, to.pos.y)
    }
    
    //draw nodes
    for (const i in this.activeNodes){
      this.nodes[this.activeNodes[i]].draw()
    }

    //simulate physics
    if (physics)
      this.applyForces()
      for (const i in this.activeNodes){
        this.nodes[this.activeNodes[i]].update()
      }
  

    //lerp hovered node towards mouse
    if (this.clicked) {
      let mousePos = createVector(mouseX, mouseY)
      let hoverNd = this.nodes[this.hoverNode]
      hoverNd.pos.lerp(mousePos, this.lerpValue)
      if (this.lerpValue < 0.95) {
        this.lerpValue += lerpValue
      }
    }

    //find nearest node "to hover over"
    this.hoverNode = this.nearestToMouse()
    this.nodes[this.hoverNode].showInfo()

    //if Q is pressed, display titles for all nodes
    if (showAllInfo)
      for (const i in this.activeNodes){
        this.nodes[this.activeNodes[i]].showInfo()
      }

  }

  changeFocus(node) {
    // Change the currently viewed node to "node" (index)

    this.viewedNode = node
    this.oldActive = this.activeNodes
    this.activeNodes = this.getNeighborhood(node, this.hops)
    this.activeSongs = this.activeNodes.filter(node => node < this.songs.length)
    this.activePlaylists = this.activeNodes.filter(node => node >= this.songs.length)
    this.activeEdges = this.getEdgesBetween(this.activeNodes)

    this.newActive = this.activeNodes.filter(node => !this.oldActive.includes(node))

    this.positionNewNodes(this.newActive)

    //for (const nd of this.oldActive)
    //  this.nodes[nd].unloadImg()
    for (const nd of this.activeSongs)
      this.nodes[nd].loadImg()
  }

  positionNewNodes(newActive){
    // Spawn new (expanded) nodes approximately around existing nodes to minimize drastic movement

    // total hack here
    for (const newNode of newActive){
      let parentNode = newNode
      for (const nb of this.getNeighbors(newNode)){
        if (this.activeNodes.includes(nb)){
          parentNode = nb
          break
        }
      }

      let originPos = this.nodes[parentNode].pos
      let r = 100
      let newPos = randomPosInCircle(originPos, r)

      this.nodes[newNode].pos = newPos
    }
  }

  onClick() {


  }

  onTouchStart() {

    let nd = this.nearestToMouse()
    let ndObj = this.nodes[nd]

    if (nd >= this.songs.length || !(ndObj.mouseOverPlay() || ndObj.mouseOverLink())){
      this.clicked = true
      this.clickPos = createVector(mouseX, mouseY)
    }
    else{
      if (ndObj.mouseOverPlay())
        ndObj.playClip()
      else if (ndObj.mouseOverLink())
        ndObj.openLink()
    }
  }

  onTouchEnd() {

    if ( this.clicked && createVector(mouseX, mouseY).dist(this.clickPos) < 10 ){
      let nd = this.nearestToMouse()
      let ndObj = this.nodes[nd]
      this.changeFocus(nd)
    }

    this.clicked = false
    this.lerpValue = lerpValue
  }


  nearestToMouse(){
    // Return node currently nearest to mouse cursor

    let minDist = 10000
    let nearest = null
    for (const nd of this.activeNodes){
      let nodeObj = this.nodes[nd]
      let dst = dist(nodeObj.pos.x, nodeObj.pos.y, mouseX, mouseY)
      if (dst < minDist){
        minDist = dst
        nearest = nd
      }
    }

    return nearest
  }

  getNeighbors(node) {
    return this.adjList[node]
  }

  getNeighborhood(node, hops) {
    // Return the "hops"-hop neighborhood of the node "node"

    var nbhd = new Set()
    nbhd.add(node)


    for (let i = 0; i < hops; i++){
        let temp = new Set()
        for (const nd of nbhd){
          let nbs = this.getNeighbors(nd)
            for (const nb of nbs)
              temp.add(nb)
        }
        for (const item of temp)
          nbhd.add(item) //this is clumsy
    }

    return Array.from(nbhd)

  }

  getEdgesBetween(nodes) {
    // Return the edges connecting "nodes"

    let edgesB = []
    for (const e of this.edges){
      if ((nodes.includes(e[0])) && (nodes.includes(e[1])))
        edgesB.push(e)
    }

    return edgesB
  }


  // PHYSICS AND MOVEMENT

  applyForces() {

    var pos, dir, force

    var center = createVector(width/2, height/2)

    //apply force towards centre
    for (const nd of this.activeNodes) {
      let node = this.nodes[nd]
      let gravity = center.copy().sub(node.pos).mult(gravityConstant).mult(0.01)
      node.force = gravity
    }
  
    // apply repulsive force between nodes
    for (const i of this.activeNodes) {
      for (const j of this.activeNodes) {
        pos = this.nodes[i].pos
        //console.log(this.nodes[i])
        dir = this.nodes[j].pos.copy().sub(pos)
        force = dir.div(dir.mag() * dir.mag() + 1e-10)
        force.mult(forceConstant).mult(0.03)
        this.nodes[i].force.add(force.copy().mult(-1))
        this.nodes[j].force.add(force)
      }
    }
  
    // spring forces applied by connections
    for (const e of this.activeEdges){
      let node1 = this.nodes[e[0]]
      let node2 = this.nodes[e[1]]
      let maxDis = e[2]
      let dis = node1.pos.copy().sub(node2.pos).mult(0.04)
      let diff = dis.mag() - maxDis
      node1.force.sub(dis)
      node2.force.add(dis)      
    }
  }




}

async function fetchJson(filepath){
  const response = await fetch(filepath);
  const json = await response.json();
  return json
}

var g
var images = {}
var playIcon
var linkIcon
var helpWindow
var mouseOverHelp = false

//var graphJson, songsJson, playlistsJson

async function preload() {
  playIcon = loadImage("spotify-graph-explorer/icons/play-button-arrowhead.png")
  linkIcon = loadImage("spotify-graph-explorer/icons/link.png")
}

async function setup() {
  createCanvas(windowWidth, windowHeight)

  helpWindow = document.getElementById("help")
  helpWindow.addEventListener("mouseover", () => {mouseOverHelp = true})
  helpWindow.addEventListener("mouseout", () => {mouseOverHelp = false})
  helpWindow.addEventListener("click", () => {helpWindow.classList.toggle("opened")})
  
  console.log("1")
  const graphJson = await fetchJson(`./${DATA_DIR}/graph.json`)
  console.log("2")
  const songsJson = await fetchJson(`./${DATA_DIR}/tracks.json`)
  console.log("3")
  const playlistsJson = await fetchJson(`./${DATA_DIR}/collections.json`)
  console.log("4")
 

  g = new Graph(graphJson, songsJson, playlistsJson, null)

  g.draw()


}

async function draw() {
  background(255)
  g.draw()
}

function mouseClicked() {
  g.onClick()
}

function touchStarted() {

  //HACK
  if (mouseOverHelp)
    return
  g.onTouchStart()
}

function touchEnded() {
  g.onTouchEnd()
}

function keyPressed() {
  if (key === "q"){
    showAllInfo = true
  }

  if (key > '0' && key <= '3'){
      g.hops = parseInt(key)
  }
}

function keyReleased() {
  showAllInfo = false
}