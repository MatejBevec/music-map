"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ɵcodegenFunctionsDirectory = exports.ɵcodegenPublicDirectory = exports.build = exports.discover = exports.type = exports.support = exports.name = void 0;
const fs_extra_1 = require("fs-extra");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const semver_1 = require("semver");
const __1 = require("..");
const utils_1 = require("../utils");
exports.name = "Nuxt";
exports.support = "experimental";
exports.type = 4;
const utils_2 = require("./utils");
const DEFAULT_BUILD_SCRIPT = ["nuxt build"];
async function discover(dir) {
    if (!(await (0, fs_extra_1.pathExists)((0, path_1.join)(dir, "package.json"))))
        return;
    const nuxtDependency = (0, __1.findDependency)("nuxt", {
        cwd: dir,
        depth: 0,
        omitDev: false,
    });
    const version = nuxtDependency === null || nuxtDependency === void 0 ? void 0 : nuxtDependency.version;
    const anyConfigFileExists = await (0, utils_2.nuxtConfigFilesExist)(dir);
    if (!anyConfigFileExists && !nuxtDependency)
        return;
    if (version && (0, semver_1.gte)(version, "3.0.0-0"))
        return { mayWantBackend: true };
    return;
}
exports.discover = discover;
async function build(root) {
    const { buildNuxt } = await (0, __1.relativeRequire)(root, "@nuxt/kit");
    const nuxtApp = await getNuxt3App(root);
    await (0, utils_1.warnIfCustomBuildScript)(root, exports.name, DEFAULT_BUILD_SCRIPT);
    await buildNuxt(nuxtApp);
    return { wantsBackend: true };
}
exports.build = build;
async function getNuxt3App(cwd) {
    const { loadNuxt } = await (0, __1.relativeRequire)(cwd, "@nuxt/kit");
    return await loadNuxt({
        cwd,
        overrides: {
            nitro: { preset: "node" },
        },
    });
}
async function ɵcodegenPublicDirectory(root, dest) {
    const distPath = (0, path_1.join)(root, ".output", "public");
    await (0, fs_extra_1.copy)(distPath, dest);
}
exports.ɵcodegenPublicDirectory = ɵcodegenPublicDirectory;
async function ɵcodegenFunctionsDirectory(sourceDir, destDir) {
    const packageJsonBuffer = await (0, promises_1.readFile)((0, path_1.join)(sourceDir, "package.json"));
    const packageJson = JSON.parse(packageJsonBuffer.toString());
    const outputPackageJsonBuffer = await (0, promises_1.readFile)((0, path_1.join)(sourceDir, ".output", "server", "package.json"));
    const outputPackageJson = JSON.parse(outputPackageJsonBuffer.toString());
    await (0, fs_extra_1.copy)((0, path_1.join)(sourceDir, ".output", "server"), destDir);
    return { packageJson: Object.assign(Object.assign({}, packageJson), outputPackageJson), frameworksEntry: "nuxt3" };
}
exports.ɵcodegenFunctionsDirectory = ɵcodegenFunctionsDirectory;
