const express = require("express")
const bodyParser = require("body-parser")
const fs = require("fs")
const util = require("util")


// INIT

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
    // TEMP: For testing
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


app.use(express.static("../client"))
app.listen(3000)