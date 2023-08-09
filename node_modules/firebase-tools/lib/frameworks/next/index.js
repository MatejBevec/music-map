"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDevModeHandle = exports.ɵcodegenFunctionsDirectory = exports.ɵcodegenPublicDirectory = exports.init = exports.build = exports.discover = exports.type = exports.support = exports.name = void 0;
const child_process_1 = require("child_process");
const cross_spawn_1 = require("cross-spawn");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const fs_extra_1 = require("fs-extra");
const url_1 = require("url");
const fs_1 = require("fs");
const semver_1 = require("semver");
const clc = require("colorette");
const stream_chain_1 = require("stream-chain");
const stream_json_1 = require("stream-json");
const Pick_1 = require("stream-json/filters/Pick");
const StreamObject_1 = require("stream-json/streamers/StreamObject");
const __1 = require("..");
const prompt_1 = require("../../prompt");
const error_1 = require("../../error");
const utils_1 = require("./utils");
const utils_2 = require("../utils");
const utils_3 = require("../utils");
const utils_4 = require("./utils");
const constants_1 = require("./constants");
const DEFAULT_BUILD_SCRIPT = ["next build"];
const PUBLIC_DIR = "public";
exports.name = "Next.js";
exports.support = "experimental";
exports.type = 2;
const DEFAULT_NUMBER_OF_REASONS_TO_LIST = 5;
function getNextVersion(cwd) {
    var _a;
    return (_a = (0, __1.findDependency)("next", { cwd, depth: 0, omitDev: false })) === null || _a === void 0 ? void 0 : _a.version;
}
function getReactVersion(cwd) {
    var _a;
    return (_a = (0, __1.findDependency)("react-dom", { cwd, omitDev: false })) === null || _a === void 0 ? void 0 : _a.version;
}
async function discover(dir) {
    if (!(await (0, fs_extra_1.pathExists)((0, path_1.join)(dir, "package.json"))))
        return;
    if (!(await (0, fs_extra_1.pathExists)("next.config.js")) && !getNextVersion(dir))
        return;
    return { mayWantBackend: true, publicDirectory: (0, path_1.join)(dir, PUBLIC_DIR) };
}
exports.discover = discover;
async function build(dir) {
    var _a, _b;
    const { default: nextBuild } = (0, __1.relativeRequire)(dir, "next/dist/build");
    await (0, utils_3.warnIfCustomBuildScript)(dir, exports.name, DEFAULT_BUILD_SCRIPT);
    const reactVersion = getReactVersion(dir);
    if (reactVersion && (0, semver_1.gte)(reactVersion, "18.0.0")) {
        process.env.__NEXT_REACT_ROOT = "true";
    }
    await nextBuild(dir, null, false, false, true).catch((e) => {
        console.error(e.message);
        throw e;
    });
    const reasonsForBackend = [];
    const { distDir, trailingSlash } = await getConfig(dir);
    if (await (0, utils_1.isUsingMiddleware)((0, path_1.join)(dir, distDir), false)) {
        reasonsForBackend.push("middleware");
    }
    if (await (0, utils_1.isUsingImageOptimization)((0, path_1.join)(dir, distDir))) {
        reasonsForBackend.push(`Image Optimization`);
    }
    if ((0, utils_1.isUsingAppDirectory)((0, path_1.join)(dir, distDir))) {
        reasonsForBackend.push("app directory (unstable)");
    }
    const prerenderManifest = await (0, utils_2.readJSON)((0, path_1.join)(dir, distDir, constants_1.PRERENDER_MANIFEST));
    const dynamicRoutesWithFallback = Object.entries(prerenderManifest.dynamicRoutes || {}).filter(([, it]) => it.fallback !== false);
    if (dynamicRoutesWithFallback.length > 0) {
        for (const [key] of dynamicRoutesWithFallback) {
            reasonsForBackend.push(`use of fallback ${key}`);
        }
    }
    const routesWithRevalidate = Object.entries(prerenderManifest.routes).filter(([, it]) => it.initialRevalidateSeconds);
    if (routesWithRevalidate.length > 0) {
        for (const [key] of routesWithRevalidate) {
            reasonsForBackend.push(`use of revalidate ${key}`);
        }
    }
    const pagesManifestJSON = await (0, utils_2.readJSON)((0, path_1.join)(dir, distDir, "server", constants_1.PAGES_MANIFEST));
    const prerenderedRoutes = Object.keys(prerenderManifest.routes);
    const dynamicRoutes = Object.keys(prerenderManifest.dynamicRoutes);
    const unrenderedPages = Object.keys(pagesManifestJSON).filter((it) => !(["/_app", "/", "/_error", "/_document", "/404"].includes(it) ||
        prerenderedRoutes.includes(it) ||
        dynamicRoutes.includes(it)));
    if (unrenderedPages.length > 0) {
        for (const key of unrenderedPages) {
            reasonsForBackend.push(`non-static route ${key}`);
        }
    }
    const manifest = await (0, utils_2.readJSON)((0, path_1.join)(dir, distDir, constants_1.ROUTES_MANIFEST));
    const { headers: nextJsHeaders = [], redirects: nextJsRedirects = [], rewrites: nextJsRewrites = [], } = manifest;
    const isEveryHeaderSupported = nextJsHeaders.every(utils_1.isHeaderSupportedByHosting);
    if (!isEveryHeaderSupported) {
        reasonsForBackend.push("advanced headers");
    }
    const headers = nextJsHeaders.filter(utils_1.isHeaderSupportedByHosting).map(({ source, headers }) => ({
        source: (0, utils_1.cleanEscapedChars)(source),
        headers,
    }));
    const isEveryRedirectSupported = nextJsRedirects
        .filter((it) => !it.internal)
        .every(utils_1.isRedirectSupportedByHosting);
    if (!isEveryRedirectSupported) {
        reasonsForBackend.push("advanced redirects");
    }
    const redirects = nextJsRedirects
        .filter(utils_1.isRedirectSupportedByHosting)
        .map(({ source, destination, statusCode: type }) => ({
        source: (0, utils_1.cleanEscapedChars)(source),
        destination,
        type,
    }));
    const nextJsRewritesToUse = (0, utils_1.getNextjsRewritesToUse)(nextJsRewrites);
    if (!Array.isArray(nextJsRewrites) &&
        (((_a = nextJsRewrites.afterFiles) === null || _a === void 0 ? void 0 : _a.length) || ((_b = nextJsRewrites.fallback) === null || _b === void 0 ? void 0 : _b.length))) {
        reasonsForBackend.push("advanced rewrites");
    }
    const isEveryRewriteSupported = nextJsRewritesToUse.every(utils_1.isRewriteSupportedByHosting);
    if (!isEveryRewriteSupported) {
        reasonsForBackend.push("advanced rewrites");
    }
    const rewrites = nextJsRewritesToUse
        .filter(utils_1.isRewriteSupportedByHosting)
        .map(({ source, destination }) => ({
        source: (0, utils_1.cleanEscapedChars)(source),
        destination,
    }));
    const wantsBackend = reasonsForBackend.length > 0;
    if (wantsBackend) {
        const numberOfReasonsToList = process.env.DEBUG ? Infinity : DEFAULT_NUMBER_OF_REASONS_TO_LIST;
        console.log("Building a Cloud Function to run this application. This is needed due to:");
        for (const reason of reasonsForBackend.slice(0, numberOfReasonsToList)) {
            console.log(` • ${reason}`);
        }
        if (reasonsForBackend.length > numberOfReasonsToList) {
            console.log(` • and ${reasonsForBackend.length - numberOfReasonsToList} other reasons, use --debug to see more`);
        }
        console.log("");
    }
    return { wantsBackend, headers, redirects, rewrites, trailingSlash };
}
exports.build = build;
async function init(setup, config) {
    const language = await (0, prompt_1.promptOnce)({
        type: "list",
        default: "TypeScript",
        message: "What language would you like to use?",
        choices: ["JavaScript", "TypeScript"],
    });
    (0, child_process_1.execSync)(`npx --yes create-next-app@latest -e hello-world ${setup.hosting.source} --use-npm ${language === "TypeScript" ? "--ts" : "--js"}`, { stdio: "inherit", cwd: config.projectDir });
}
exports.init = init;
async function ɵcodegenPublicDirectory(sourceDir, destDir) {
    const { distDir } = await getConfig(sourceDir);
    const publicPath = (0, path_1.join)(sourceDir, "public");
    await (0, promises_1.mkdir)((0, path_1.join)(destDir, "_next", "static"), { recursive: true });
    if (await (0, fs_extra_1.pathExists)(publicPath)) {
        await (0, fs_extra_1.copy)(publicPath, destDir);
    }
    await (0, fs_extra_1.copy)((0, path_1.join)(sourceDir, distDir, "static"), (0, path_1.join)(destDir, "_next", "static"));
    for (const file of ["index.html", "404.html", "500.html"]) {
        const pagesPath = (0, path_1.join)(sourceDir, distDir, "server", "pages", file);
        if (await (0, fs_extra_1.pathExists)(pagesPath)) {
            await (0, promises_1.copyFile)(pagesPath, (0, path_1.join)(destDir, file));
            continue;
        }
        const appPath = (0, path_1.join)(sourceDir, distDir, "server", "app", file);
        if (await (0, fs_extra_1.pathExists)(appPath)) {
            await (0, promises_1.copyFile)(appPath, (0, path_1.join)(destDir, file));
        }
    }
    const [middlewareManifest, prerenderManifest, routesManifest] = await Promise.all([
        (0, utils_2.readJSON)((0, path_1.join)(sourceDir, distDir, "server", constants_1.MIDDLEWARE_MANIFEST)),
        (0, utils_2.readJSON)((0, path_1.join)(sourceDir, distDir, constants_1.PRERENDER_MANIFEST)),
        (0, utils_2.readJSON)((0, path_1.join)(sourceDir, distDir, constants_1.ROUTES_MANIFEST)),
    ]);
    const middlewareMatcherRegexes = Object.values(middlewareManifest.middleware)
        .map((it) => it.matchers)
        .flat()
        .map((it) => new RegExp(it.regexp));
    const { redirects = [], rewrites = [], headers = [] } = routesManifest;
    const rewritesRegexesNotSupportedByHosting = (0, utils_1.getNextjsRewritesToUse)(rewrites)
        .filter((rewrite) => !(0, utils_1.isRewriteSupportedByHosting)(rewrite))
        .map((rewrite) => new RegExp(rewrite.regex));
    const redirectsRegexesNotSupportedByHosting = redirects
        .filter((redirect) => !(0, utils_1.isRedirectSupportedByHosting)(redirect))
        .map((redirect) => new RegExp(redirect.regex));
    const headersRegexesNotSupportedByHosting = headers
        .filter((header) => !(0, utils_1.isHeaderSupportedByHosting)(header))
        .map((header) => new RegExp(header.regex));
    const pathsUsingsFeaturesNotSupportedByHosting = [
        ...middlewareMatcherRegexes,
        ...rewritesRegexesNotSupportedByHosting,
        ...redirectsRegexesNotSupportedByHosting,
        ...headersRegexesNotSupportedByHosting,
    ];
    for (const [path, route] of Object.entries(prerenderManifest.routes)) {
        if (route.initialRevalidateSeconds ||
            pathsUsingsFeaturesNotSupportedByHosting.some((it) => path.match(it))) {
            continue;
        }
        const isReactServerComponent = route.dataRoute.endsWith(".rsc");
        const contentDist = (0, path_1.join)(sourceDir, distDir, "server", isReactServerComponent ? "app" : "pages");
        const parts = path.split("/").filter((it) => !!it);
        const partsOrIndex = parts.length > 0 ? parts : ["index"];
        const htmlPath = `${(0, path_1.join)(...partsOrIndex)}.html`;
        await (0, promises_1.mkdir)((0, path_1.join)(destDir, (0, path_1.dirname)(htmlPath)), { recursive: true });
        await (0, promises_1.copyFile)((0, path_1.join)(contentDist, htmlPath), (0, path_1.join)(destDir, htmlPath));
        if (!isReactServerComponent) {
            const dataPath = `${(0, path_1.join)(...partsOrIndex)}.json`;
            await (0, promises_1.mkdir)((0, path_1.join)(destDir, (0, path_1.dirname)(route.dataRoute)), { recursive: true });
            await (0, promises_1.copyFile)((0, path_1.join)(contentDist, dataPath), (0, path_1.join)(destDir, route.dataRoute));
        }
    }
}
exports.ɵcodegenPublicDirectory = ɵcodegenPublicDirectory;
async function ɵcodegenFunctionsDirectory(sourceDir, destDir) {
    const { distDir } = await getConfig(sourceDir);
    const packageJson = await (0, utils_2.readJSON)((0, path_1.join)(sourceDir, "package.json"));
    if ((0, fs_1.existsSync)((0, path_1.join)(sourceDir, "next.config.js"))) {
        try {
            const productionDeps = await new Promise((resolve) => {
                const dependencies = [];
                const pipeline = (0, stream_chain_1.chain)([
                    (0, cross_spawn_1.spawn)("npm", ["ls", "--omit=dev", "--all", "--json"], { cwd: sourceDir }).stdout,
                    (0, stream_json_1.parser)({ packValues: false, packKeys: true, streamValues: false }),
                    (0, Pick_1.pick)({ filter: "dependencies" }),
                    (0, StreamObject_1.streamObject)(),
                    ({ key, value }) => [
                        key,
                        ...(0, utils_1.allDependencyNames)(value),
                    ],
                ]);
                pipeline.on("data", (it) => dependencies.push(it));
                pipeline.on("end", () => {
                    resolve([...new Set(dependencies)]);
                });
            });
            const esbuildArgs = productionDeps
                .map((it) => `--external:${it}`)
                .concat("--bundle", "--platform=node", `--target=node${__1.NODE_VERSION}`, `--outdir=${destDir}`, "--log-level=error");
            const bundle = (0, cross_spawn_1.sync)("npx", ["--yes", "esbuild", "next.config.js", ...esbuildArgs], {
                cwd: sourceDir,
            });
            if (bundle.status) {
                throw new error_1.FirebaseError(bundle.stderr.toString());
            }
        }
        catch (e) {
            console.warn("Unable to bundle next.config.js for use in Cloud Functions, proceeding with deploy but problems may be enountered.");
            console.error(e.message);
            (0, fs_extra_1.copy)((0, path_1.join)(sourceDir, "next.config.js"), (0, path_1.join)(destDir, "next.config.js"));
        }
    }
    if (await (0, fs_extra_1.pathExists)((0, path_1.join)(sourceDir, "public"))) {
        await (0, promises_1.mkdir)((0, path_1.join)(destDir, "public"));
        await (0, fs_extra_1.copy)((0, path_1.join)(sourceDir, "public"), (0, path_1.join)(destDir, "public"));
    }
    if (!(await (0, utils_4.hasUnoptimizedImage)(sourceDir, distDir)) &&
        ((0, utils_4.usesAppDirRouter)(sourceDir) || (await (0, utils_4.usesNextImage)(sourceDir, distDir)))) {
        packageJson.dependencies["sharp"] = "latest";
    }
    await (0, fs_extra_1.mkdirp)((0, path_1.join)(destDir, distDir));
    await (0, fs_extra_1.copy)((0, path_1.join)(sourceDir, distDir), (0, path_1.join)(destDir, distDir));
    return { packageJson, frameworksEntry: "next.js" };
}
exports.ɵcodegenFunctionsDirectory = ɵcodegenFunctionsDirectory;
async function getDevModeHandle(dir, hostingEmulatorInfo) {
    if (!hostingEmulatorInfo) {
        if (await (0, utils_1.isUsingMiddleware)(dir, true)) {
            throw new error_1.FirebaseError(`${clc.bold("firebase serve")} does not support Next.js Middleware. Please use ${clc.bold("firebase emulators:start")} instead.`);
        }
    }
    const { default: next } = (0, __1.relativeRequire)(dir, "next");
    const nextApp = next({
        dev: true,
        dir,
        hostname: hostingEmulatorInfo === null || hostingEmulatorInfo === void 0 ? void 0 : hostingEmulatorInfo.host,
        port: hostingEmulatorInfo === null || hostingEmulatorInfo === void 0 ? void 0 : hostingEmulatorInfo.port,
    });
    const handler = nextApp.getRequestHandler();
    await nextApp.prepare();
    return (0, utils_2.simpleProxy)(async (req, res) => {
        const parsedUrl = (0, url_1.parse)(req.url, true);
        await handler(req, res, parsedUrl);
    });
}
exports.getDevModeHandle = getDevModeHandle;
async function getConfig(dir) {
    var _a;
    let config = {};
    if ((0, fs_1.existsSync)((0, path_1.join)(dir, "next.config.js"))) {
        const version = getNextVersion(dir);
        if (!version)
            throw new Error("Unable to find the next dep, try NPM installing?");
        if ((0, semver_1.gte)(version, "12.0.0")) {
            const { default: loadConfig } = (0, __1.relativeRequire)(dir, "next/dist/server/config");
            const { PHASE_PRODUCTION_BUILD } = (0, __1.relativeRequire)(dir, "next/constants");
            config = await loadConfig(PHASE_PRODUCTION_BUILD, dir, null);
        }
        else {
            try {
                config = await (_a = (0, url_1.pathToFileURL)((0, path_1.join)(dir, "next.config.js")).toString(), Promise.resolve().then(() => require(_a)));
            }
            catch (e) {
                throw new Error("Unable to load next.config.js.");
            }
        }
    }
    return Object.assign({ distDir: ".next", trailingSlash: false }, config);
}
