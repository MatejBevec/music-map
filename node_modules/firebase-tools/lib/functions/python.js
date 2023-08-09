"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runWithVirtualEnv = void 0;
const path = require("path");
const spawn = require("cross-spawn");
const logger_1 = require("../logger");
const DEFAULT_VENV_DIR = "venv";
function runWithVirtualEnv(commandAndArgs, cwd, envs, spawnOpts = {}, venvDir = DEFAULT_VENV_DIR) {
    const activateScriptPath = process.platform === "win32" ? ["Scripts", "activate.bat"] : ["bin", "activate"];
    const venvActivate = path.join(cwd, venvDir, ...activateScriptPath);
    const command = process.platform === "win32" ? venvActivate : "source";
    const args = [process.platform === "win32" ? "" : venvActivate, "&&", ...commandAndArgs];
    logger_1.logger.debug(`Running command with virtualenv: command=${command}, args=${JSON.stringify(args)}`);
    return spawn(command, args, Object.assign(Object.assign({ shell: true, cwd, stdio: ["pipe", "pipe", "pipe", "pipe"] }, spawnOpts), { env: envs }));
}
exports.runWithVirtualEnv = runWithVirtualEnv;
