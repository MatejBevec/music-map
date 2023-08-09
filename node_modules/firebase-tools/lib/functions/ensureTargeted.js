"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTargeted = void 0;
function ensureTargeted(only, codebase, id) {
    const parts = only.split(",");
    if (parts.includes("functions")) {
        return only;
    }
    let newTarget = `functions:${codebase}`;
    if (parts.includes(newTarget)) {
        return only;
    }
    if (id) {
        newTarget = `${newTarget}:${id}`;
        if (parts.includes(newTarget)) {
            return only;
        }
    }
    return `${only},${newTarget}`;
}
exports.ensureTargeted = ensureTargeted;
