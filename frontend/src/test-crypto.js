"use strict";
/**
 * Teste para descriptografia de dados no formato Iron
 * Execute com: npx ts-node test-crypto.ts
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var crypto_utils_1 = require("./utils/crypto-utils");
// Dados criptografados para teste
var encryptedData = {
    "encrypted": true,
    "format": "iron",
    "encryptedData": "Fe26.2*1b9ee4ee7956b9f7aebcea1947a690b7*V7lJFUMXnDRnVBI4ADL3nf2E+PerGGhU2luJpiMtJzyrJtqeNs232N4w73JwcL+v2gO3Lxa/oJ0stRyPALwkR2g6/HNCCyy4zKk6YL39N6adV3NANgaXlpdyCDKAGFuQD2viRjDfKTHpC8Liv+s4/qX7UnnmF7+E1vhpRx1iWREi1QuPII9Bn3EAotSa+1aa",
    "message": "Dados criptografados. Use sua chave de acesso para descriptografar.",
    "_timestamp": 1746437894271
};
// Dados em formato de 3 partes
var ironThreeParts = "Fe26.2*bcf3ce05f3baa107058d6e4ef7bb9718*ynzV/q7fkJnO3BzLUG9wXjbvjXS9HvPZKRXCZq7IqS4ylO+P9JwIdvg4tHCbpV0Y+8cYt8iJpCE88v2YZ0AtcnlxUYfCGhPMTbcJ+PsEvnbouh+/qvFhsU/3nI3I";
function testDecryption() {
    return __awaiter(this, void 0, void 0, function () {
        var testKeys, _i, testKeys_1, key, result1, e_1, result2, e_2, result3, e_3, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 13, , 14]);
                    console.log("=== TESTE DE DESCRIPTOGRAFIA ===");
                    // Configurar a chave de acesso para teste
                    console.log("Configurando chave de acesso...");
                    testKeys = [
                        'mcs128i123xcxvc-testkey-production-v1', // Chave padrão usada em setupAccessKey
                        'runcash-production-key-v1', // Tente esta chave alternativa
                        'api-access-key-2025-v1', // Outra alternativa
                        '1b9ee4ee7956b9f7aebcea1947a690b7' // Hash do próprio cabeçalho como chave
                    ];
                    _i = 0, testKeys_1 = testKeys;
                    _a.label = 1;
                case 1:
                    if (!(_i < testKeys_1.length)) return [3 /*break*/, 12];
                    key = testKeys_1[_i];
                    console.log("\nTestando com chave: ".concat(key));
                    (0, crypto_utils_1.setAccessKey)(key);
                    _a.label = 2;
                case 2:
                    _a.trys.push([2, 4, , 5]);
                    // Teste 1: Descriptografar objeto completo
                    console.log("\n--- Teste 1: Descriptografar objeto completo ---");
                    return [4 /*yield*/, crypto_utils_1.cryptoService.processEncryptedData(encryptedData)];
                case 3:
                    result1 = _a.sent();
                    console.log("Resultado:", JSON.stringify(result1, null, 2));
                    console.log("✅ Sucesso com o objeto completo!");
                    return [3 /*break*/, 5];
                case 4:
                    e_1 = _a.sent();
                    console.log("❌ Falha ao descriptografar objeto completo:", e_1.message);
                    return [3 /*break*/, 5];
                case 5:
                    _a.trys.push([5, 7, , 8]);
                    // Teste 2: Descriptografar apenas o campo encryptedData
                    console.log("\n--- Teste 2: Descriptografar apenas encryptedData ---");
                    return [4 /*yield*/, crypto_utils_1.cryptoService.decryptData(encryptedData.encryptedData)];
                case 6:
                    result2 = _a.sent();
                    console.log("Resultado:", JSON.stringify(result2, null, 2));
                    console.log("✅ Sucesso com encryptedData!");
                    return [3 /*break*/, 8];
                case 7:
                    e_2 = _a.sent();
                    console.log("❌ Falha ao descriptografar encryptedData:", e_2.message);
                    return [3 /*break*/, 8];
                case 8:
                    _a.trys.push([8, 10, , 11]);
                    // Teste 3: Descriptografar formato de 3 partes
                    console.log("\n--- Teste 3: Descriptografar formato de 3 partes ---");
                    return [4 /*yield*/, crypto_utils_1.cryptoService.decryptData(ironThreeParts)];
                case 9:
                    result3 = _a.sent();
                    console.log("Resultado:", JSON.stringify(result3, null, 2));
                    console.log("✅ Sucesso com formato de 3 partes!");
                    return [3 /*break*/, 11];
                case 10:
                    e_3 = _a.sent();
                    console.log("❌ Falha ao descriptografar formato de 3 partes:", e_3.message);
                    return [3 /*break*/, 11];
                case 11:
                    _i++;
                    return [3 /*break*/, 1];
                case 12: return [3 /*break*/, 14];
                case 13:
                    error_1 = _a.sent();
                    console.error("Erro no teste:", error_1);
                    return [3 /*break*/, 14];
                case 14: return [2 /*return*/];
            }
        });
    });
}
// Executar o teste
testDecryption().then(function () {
    console.log("\nTestes concluídos.");
}).catch(function (err) {
    console.error("Erro ao executar testes:", err);
});
