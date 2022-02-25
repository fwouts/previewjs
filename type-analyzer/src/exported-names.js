"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectExportedNames = void 0;
const typescript_1 = __importDefault(require("typescript"));
function detectExportedNames(sourceFile) {
    var _a;
    const nameToExportedName = {};
    for (const statement of sourceFile.statements) {
        if (typescript_1.default.isExportDeclaration(statement)) {
            if (statement.exportClause && typescript_1.default.isNamedExports(statement.exportClause)) {
                for (const specifier of statement.exportClause.elements) {
                    const name = (specifier.propertyName || specifier.name).text;
                    const exportedName = specifier.name.text;
                    nameToExportedName[name] = exportedName;
                }
            }
            continue;
        }
        if (typescript_1.default.isExportAssignment(statement) &&
            typescript_1.default.isIdentifier(statement.expression)) {
            const name = statement.expression.text;
            nameToExportedName[name] = "default";
            continue;
        }
        const hasExportModifier = ((_a = statement.modifiers) === null || _a === void 0 ? void 0 : _a.find((modifier) => modifier.kind === typescript_1.default.SyntaxKind.ExportKeyword)) || false;
        if (typescript_1.default.isVariableStatement(statement)) {
            for (const declaration of statement.declarationList.declarations) {
                if (!typescript_1.default.isIdentifier(declaration.name)) {
                    continue;
                }
                const name = declaration.name.text;
                if (hasExportModifier) {
                    nameToExportedName[name] = name;
                }
            }
        }
        else if (typescript_1.default.isFunctionDeclaration(statement) && statement.name) {
            const name = statement.name.text;
            if (hasExportModifier) {
                nameToExportedName[name] = name;
            }
        }
        else if (typescript_1.default.isClassDeclaration(statement) && statement.name) {
            const name = statement.name.text;
            if (hasExportModifier) {
                nameToExportedName[name] = name;
            }
        }
    }
    return nameToExportedName;
}
exports.detectExportedNames = detectExportedNames;
