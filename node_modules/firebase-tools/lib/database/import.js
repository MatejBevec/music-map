"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Chain = require("stream-chain");
const clc = require("colorette");
const Filter = require("stream-json/filters/Filter");
const stream = require("stream");
const StreamObject = require("stream-json/streamers/StreamObject");
const apiv2_1 = require("../apiv2");
const error_1 = require("../error");
const pLimit = require("p-limit");
const MAX_CHUNK_SIZE = 1024 * 1024 * 10;
const CONCURRENCY_LIMIT = 5;
class DatabaseImporter {
    constructor(dbUrl, inStream, dataPath, chunkSize = MAX_CHUNK_SIZE) {
        this.dbUrl = dbUrl;
        this.inStream = inStream;
        this.dataPath = dataPath;
        this.chunkSize = chunkSize;
        this.limit = pLimit(CONCURRENCY_LIMIT);
        this.client = new apiv2_1.Client({ urlPrefix: dbUrl.origin, auth: true });
    }
    async execute() {
        await this.checkLocationIsEmpty();
        return this.readAndWriteChunks();
    }
    async checkLocationIsEmpty() {
        const response = await this.client.request({
            method: "GET",
            path: this.dbUrl.pathname + ".json",
            queryParams: { shallow: "true" },
        });
        if (response.body) {
            throw new error_1.FirebaseError("Importing is only allowed for an empty location. Delete all data by running " +
                clc.bold(`firebase database:remove ${this.dbUrl.pathname} --disable-triggers`) +
                ", then rerun this command.", { exit: 2 });
        }
    }
    readAndWriteChunks() {
        const { dbUrl } = this;
        const chunkData = this.chunkData.bind(this);
        const writeChunk = this.writeChunk.bind(this);
        const getJoinedPath = this.joinPath.bind(this);
        const readChunks = new stream.Transform({ objectMode: true });
        readChunks._transform = function (chunk, _, done) {
            const data = { json: chunk.value, pathname: getJoinedPath(dbUrl.pathname, chunk.key) };
            const chunkedData = chunkData(data);
            const chunks = chunkedData.chunks || [data];
            for (const chunk of chunks) {
                this.push(chunk);
            }
            done();
        };
        const writeChunks = new stream.Transform({ objectMode: true });
        writeChunks._transform = async function (chunk, _, done) {
            const res = await writeChunk(chunk);
            this.push(res);
            done();
        };
        return new Promise((resolve, reject) => {
            const responses = [];
            const pipeline = new Chain([
                this.inStream,
                Filter.withParser({
                    filter: this.computeFilterString(this.dataPath) || (() => true),
                    pathSeparator: "/",
                }),
                StreamObject.streamObject(),
            ]);
            pipeline
                .on("error", (err) => reject(new error_1.FirebaseError(`Invalid data; couldn't parse JSON object, array, or value. ${err.message}`, {
                original: err,
                exit: 2,
            })))
                .pipe(readChunks)
                .pipe(writeChunks)
                .on("data", (res) => responses.push(res))
                .on("error", reject)
                .once("end", () => resolve(responses));
        });
    }
    writeChunk(chunk) {
        return this.limit(() => this.client.request({
            method: "PUT",
            path: chunk.pathname + ".json",
            body: JSON.stringify(chunk.json),
            queryParams: this.dbUrl.searchParams,
        }));
    }
    chunkData({ json, pathname }) {
        if (typeof json === "string" || typeof json === "number" || typeof json === "boolean") {
            return { chunks: null, size: JSON.stringify(json).length };
        }
        else {
            let size = 2;
            const chunks = [];
            let hasChunkedChild = false;
            for (const [key, val] of Object.entries(json)) {
                size += key.length + 3;
                const child = { json: val, pathname: this.joinPath(pathname, key) };
                const childChunks = this.chunkData(child);
                size += childChunks.size;
                if (childChunks.chunks) {
                    hasChunkedChild = true;
                    chunks.push(...childChunks.chunks);
                }
                else {
                    chunks.push(child);
                }
            }
            if (hasChunkedChild || size >= this.chunkSize) {
                return { chunks, size };
            }
            else {
                return { chunks: null, size };
            }
        }
    }
    computeFilterString(dataPath) {
        return dataPath.split("/").filter(Boolean).join("/");
    }
    joinPath(root, key) {
        return [root, key].join("/").replace("//", "/");
    }
}
exports.default = DatabaseImporter;
