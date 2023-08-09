"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allDependencyNames = exports.isUsingAppDirectory = exports.isUsingImageOptimization = exports.isUsingMiddleware = exports.hasUnoptimizedImage = exports.usesNextImage = exports.usesAppDirRouter = exports.getNextjsRewritesToUse = exports.isHeaderSupportedByHosting = exports.isRedirectSupportedByHosting = exports.isRewriteSupportedByHosting = exports.cleanEscapedChars = exports.pathHasRegex = void 0;
const fs_1 = require("fs");
const fs_extra_1 = require("fs-extra");
const path_1 = require("path");
const utils_1 = require("../utils");
const constants_1 = require("./constants");
const fsutils_1 = require("../../fsutils");
function pathHasRegex(path) {
    return /(?<!\\)\(/.test(path);
}
exports.pathHasRegex = pathHasRegex;
function cleanEscapedChars(path) {
    return path.replace(/\\([(){}:+?*])/g, (a, b) => b);
}
exports.cleanEscapedChars = cleanEscapedChars;
function isRewriteSupportedByHosting(rewrite) {
    return !("has" in rewrite || pathHasRegex(rewrite.source) || (0, utils_1.isUrl)(rewrite.destination));
}
exports.isRewriteSupportedByHosting = isRewriteSupportedByHosting;
function isRedirectSupportedByHosting(redirect) {
    return !("has" in redirect || pathHasRegex(redirect.source) || "internal" in redirect);
}
exports.isRedirectSupportedByHosting = isRedirectSupportedByHosting;
function isHeaderSupportedByHosting(header) {
    return !("has" in header || pathHasRegex(header.source));
}
exports.isHeaderSupportedByHosting = isHeaderSupportedByHosting;
function getNextjsRewritesToUse(nextJsRewrites) {
    if (Array.isArray(nextJsRewrites)) {
        return nextJsRewrites;
    }
    if (nextJsRewrites === null || nextJsRewrites === void 0 ? void 0 : nextJsRewrites.beforeFiles) {
        return nextJsRewrites.beforeFiles;
    }
    return [];
}
exports.getNextjsRewritesToUse = getNextjsRewritesToUse;
function usesAppDirRouter(sourceDir) {
    const appPathRoutesManifestPath = (0, path_1.join)(sourceDir, constants_1.APP_PATH_ROUTES_MANIFEST);
    return (0, fs_1.existsSync)(appPathRoutesManifestPath);
}
exports.usesAppDirRouter = usesAppDirRouter;
async function usesNextImage(sourceDir, distDir) {
    const exportMarker = await (0, utils_1.readJSON)((0, path_1.join)(sourceDir, distDir, constants_1.EXPORT_MARKER));
    return exportMarker.isNextImageImported;
}
exports.usesNextImage = usesNextImage;
async function hasUnoptimizedImage(sourceDir, distDir) {
    const imagesManifest = await (0, utils_1.readJSON)((0, path_1.join)(sourceDir, distDir, constants_1.IMAGES_MANIFEST));
    return imagesManifest.images.unoptimized;
}
exports.hasUnoptimizedImage = hasUnoptimizedImage;
async function isUsingMiddleware(dir, isDevMode) {
    if (isDevMode) {
        const [middlewareJs, middlewareTs] = await Promise.all([
            (0, fs_extra_1.pathExists)((0, path_1.join)(dir, "middleware.js")),
            (0, fs_extra_1.pathExists)((0, path_1.join)(dir, "middleware.ts")),
        ]);
        return middlewareJs || middlewareTs;
    }
    else {
        const middlewareManifest = await (0, utils_1.readJSON)((0, path_1.join)(dir, "server", constants_1.MIDDLEWARE_MANIFEST));
        return Object.keys(middlewareManifest.middleware).length > 0;
    }
}
exports.isUsingMiddleware = isUsingMiddleware;
async function isUsingImageOptimization(dir) {
    const { isNextImageImported } = await (0, utils_1.readJSON)((0, path_1.join)(dir, constants_1.EXPORT_MARKER));
    if (isNextImageImported) {
        const imagesManifest = await (0, utils_1.readJSON)((0, path_1.join)(dir, constants_1.IMAGES_MANIFEST));
        const usingImageOptimization = imagesManifest.images.unoptimized === false;
        if (usingImageOptimization) {
            return true;
        }
    }
    return false;
}
exports.isUsingImageOptimization = isUsingImageOptimization;
function isUsingAppDirectory(dir) {
    const appPathRoutesManifestPath = (0, path_1.join)(dir, constants_1.APP_PATH_ROUTES_MANIFEST);
    return (0, fsutils_1.fileExistsSync)(appPathRoutesManifestPath);
}
exports.isUsingAppDirectory = isUsingAppDirectory;
function allDependencyNames(mod) {
    if (!mod.dependencies)
        return [];
    const dependencyNames = Object.keys(mod.dependencies).reduce((acc, it) => [...acc, it, ...allDependencyNames(mod.dependencies[it])], []);
    return dependencyNames;
}
exports.allDependencyNames = allDependencyNames;
