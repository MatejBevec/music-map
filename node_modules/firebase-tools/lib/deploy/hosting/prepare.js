"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepare = void 0;
const error_1 = require("../../error");
const api = require("../../hosting/api");
const config = require("../../hosting/config");
const deploymentTool = require("../../deploymentTool");
const functional_1 = require("../../functional");
const track_1 = require("../../track");
async function prepare(context, options) {
    if (options.public) {
        if (Array.isArray(options.config.get("hosting"))) {
            throw new error_1.FirebaseError("Cannot specify --public option with multi-site configuration.");
        }
        options.config.set("hosting.public", options.public);
    }
    const configs = config.hostingConfig(options);
    if (configs.length === 0) {
        return Promise.resolve();
    }
    const versions = await Promise.all(configs.map(async (config) => {
        const labels = Object.assign({}, deploymentTool.labels());
        if (config.webFramework) {
            labels["firebase-web-framework"] = config.webFramework;
        }
        const version = {
            status: "CREATED",
            labels,
        };
        const [, versionName] = await Promise.all([
            (0, track_1.track)("hosting_deploy", config.webFramework || "classic"),
            api.createVersion(config.site, version),
        ]);
        return versionName;
    }));
    context.hosting = {
        deploys: [],
    };
    for (const [config, version] of configs.map((0, functional_1.zipIn)(versions))) {
        context.hosting.deploys.push({ config, version });
    }
}
exports.prepare = prepare;
