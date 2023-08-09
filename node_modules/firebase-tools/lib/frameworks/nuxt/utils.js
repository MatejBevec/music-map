"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nuxtConfigFilesExist = void 0;
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
async function nuxtConfigFilesExist(dir) {
    const configFilesExist = await Promise.all([
        (0, fs_extra_1.pathExists)((0, path_1.join)(dir, "nuxt.config.js")),
        (0, fs_extra_1.pathExists)((0, path_1.join)(dir, "nuxt.config.ts")),
    ]);
    return configFilesExist.some((it) => it);
}
exports.nuxtConfigFilesExist = nuxtConfigFilesExist;
