"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const setup = async () => {
    return {
        middlewares: [express_1.default.static(findClientDir(__dirname))],
    };
};
function findClientDir(dirPath) {
    const potentialPath = path_1.default.join(dirPath, "client", "dist");
    if (fs_1.default.existsSync(potentialPath)) {
        return potentialPath;
    }
    else {
        const parentPath = path_1.default.dirname(dirPath);
        if (!parentPath || parentPath === dirPath) {
            throw new Error(`Unable to find compiled client directory (client/dist)`);
        }
        return findClientDir(parentPath);
    }
}
exports.default = setup;
