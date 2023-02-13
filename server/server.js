const express = require("express")
const bodyParser = require("body-parser")
const fs = require("fs")
const util = require("util")

const app = express()
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: false }))

const DATA_DIR = "../client/data/small"

function loadIds() {
    const data = fs.readFileSync(DATA_DIR + "/graph.json")
    const ids = JSON.parse(data)["tracks"]
    return ids
}

const IDS = loadIds()


// ENDPOINTS

app.get("/", (req, res) => {
    res.redirect("/index.html")
})

function loadImg(path) {
    const blob = fs.readFileSync(path, "base64url")
    //return new Buffer.from(blob).toString("base64")
    return blob
}


function loadImgsSync(ids){
    const batch = {}
    for (let id of ids){
        console.log(id)
        const path = DATA_DIR + "/resized_images/" + id + ".jpg"
        let dataUrl = fs.readFileSync(path, "base64url")
        dataUrl = "data:image/png;base64," + dataUrl
        batch[id] = dataUrl        
    }
    return batch
}

const readFile = util.promisify(fs.readFile)

async function loadImgs(ids){
    const batch = {}
    for (let id of ids){
        console.log(id)
        const path = DATA_DIR + "/resized_images/" + id + ".jpg"
        //let err, dataUrl
        let dataUrl = await readFile(path, "base64url", )
        dataUrl = "data:image/png;base64," + dataUrl
        batch[id] = dataUrl        
    }
    return batch
}

app.get("/images", (req, res) => {
    // Send the requested batch of images as json of data URLs
    const ids = IDS.slice(0, 100)
    loadImgs(ids).then((batch) => {
        res.json(batch)
    })
})

app.post("/images", (req, res) => {
    // Send the requested batch of images as json of data URLs
    const ids = req.body
    loadImgs(ids).then((batch) => {
        console.log("done")
        res.json(batch)
    })
    
})

app.get("/imgtest", (req, res) => {
    const batch = {}
    for (let i = 0; i < 1; i++){
        const id = IDS[i]
        const path = DATA_DIR + "/resized_images/" + id + ".jpg"
        console.log("Reading " + path)
        let dataUrl = fs.readFileSync(path, "base64url")
        dataUrl = "data:image/png;base64," + dataUrl
        batch[id] = dataUrl
    }
    res.json(batch)
})


app.use(express.static("../client"))

app.listen(3000)