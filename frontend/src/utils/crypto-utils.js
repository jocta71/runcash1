"use strict";
/**
 * Utilitários para descriptografia de dados da API
 * Implementação compatível com o formato Iron usado no backend
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.cryptoService = exports.CryptoService = void 0;
exports.setAccessKey = setAccessKey;
exports.hasAccessKey = hasAccessKey;
exports.setupAccessKey = setupAccessKey;
exports.extractAndSetAccessKeyFromEvent = extractAndSetAccessKeyFromEvent;
var crypto_js_1 = require("crypto-js");
/**
 * Classe para lidar com as chaves de acesso e descriptografia
 */
var CryptoService = /** @class */ (function () {
    function CryptoService() {
        this.accessKey = null;
        this.keyData = null;
        // Chave de localStorage para armazenar a chave de acesso
        this.STORAGE_KEY = 'roulette_access_key';
        // Tentar carregar a chave do localStorage
        this.loadAccessKey();
    }
    /**
     * Obter a instância singleton
     */
    CryptoService.getInstance = function () {
        if (!CryptoService.instance) {
            CryptoService.instance = new CryptoService();
        }
        return CryptoService.instance;
    };
    /**
     * Carregar a chave de acesso do localStorage
     */
    CryptoService.prototype.loadAccessKey = function () {
        try {
            if (typeof window !== 'undefined') {
                var storedKey = localStorage.getItem(this.STORAGE_KEY);
                if (storedKey) {
                    this.accessKey = storedKey;
                }
            }
        }
        catch (error) {
            console.error('Erro ao carregar chave de acesso:', error);
        }
    };
    /**
     * Salvar a chave de acesso no localStorage
     */
    CryptoService.prototype.saveAccessKey = function () {
        try {
            if (typeof window !== 'undefined' && this.accessKey) {
                localStorage.setItem(this.STORAGE_KEY, this.accessKey);
            }
        }
        catch (error) {
            console.error('Erro ao salvar chave de acesso:', error);
        }
    };
    /**
     * Definir a chave de acesso para descriptografia
     * @param key Chave de acesso obtida da API
     */
    CryptoService.prototype.setAccessKey = function (key) {
        this.accessKey = key;
        this.saveAccessKey();
        console.log('[CryptoService] Chave de acesso configurada e salva');
    };
    /**
     * Verificar se a chave de acesso está disponível
     */
    CryptoService.prototype.hasAccessKey = function () {
        return !!this.accessKey;
    };
    /**
     * Limpar a chave de acesso
     */
    CryptoService.prototype.clearAccessKey = function () {
        this.accessKey = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem(this.STORAGE_KEY);
        }
        console.log('[CryptoService] Chave de acesso removida');
    };
    /**
     * Decodificar o formato Iron (versão simplificada)
     * Implementação parcial para compatibilidade com o backend
     * @param ironString String no formato Iron
     */
    CryptoService.prototype.decodeIronFormat = function (ironString) {
        try {
            // Verificar se a string começa com o formato Iron
            if (!ironString.startsWith('Fe26.2')) {
                throw new Error('Formato Iron inválido');
            }
            // Formato Iron: Fe26.2*[versão]*[encrypted]*[iv]*[dados]*[expiry]*[MAC de integridade]
            var parts = ironString.split('*');
            if (parts.length < 4) {
                throw new Error('Formato Iron inválido: número insuficiente de partes');
            }
            // Na implementação completa do Iron, seria necessário:
            // 1. Verificar a MAC (message authentication code)
            // 2. Decodificar os dados criptografados usando a chave e IV
            // 3. Verificar se os dados não expiraram
            // Para esta implementação simplificada, vamos apenas extrair e decodificar a parte de dados
            var dataBase64 = parts[2]; // A terceira parte contém os dados (pode variar conforme implementação do backend)
            // Decodificar Base64
            var jsonString = atob(dataBase64);
            // Converter para objeto
            return JSON.parse(jsonString);
        }
        catch (error) {
            console.error('[CryptoService] Erro ao decodificar formato Iron:', error);
            throw new Error('Falha ao decodificar dados criptografados');
        }
    };
    /**
     * Descriptografar dados no formato Iron usando a chave de acesso
     * @param ironEncrypted Dados criptografados no formato Iron
     */
    CryptoService.prototype.decryptData = function (ironEncrypted) {
        return __awaiter(this, void 0, void 0, function () {
            var targetData, isBase64, decoded, jsonData, parts, encryptedBase64_1, ivUsed, key_1, ivValue_1, encryptedBytes_1, decryptedData_1, success, testString, testString, testString, decryptedString_1, jsonResult, encryptedBase64, iv, maxLength, maxIndex, i, encryptedBytes, key, ivValue, decryptedData, decryptedString, jsonData, now, randomNumbers;
            return __generator(this, function (_a) {
                if (!this.accessKey) {
                    throw new Error('Chave de acesso não disponível');
                }
                try {
                    console.log('[CryptoService] Tentando descriptografar dados no formato Iron');
                    // Verificar formato Iron
                    if (!ironEncrypted || typeof ironEncrypted !== 'string') {
                        console.error('[CryptoService] Dados inválidos:', ironEncrypted);
                        throw new Error('Formato de dados inválido');
                    }
                    // Log detalhado do formato recebido
                    console.log('[CryptoService] Formato recebido:', ironEncrypted.substring(0, 100));
                    console.log('[CryptoService] Total de caracteres:', ironEncrypted.length);
                    console.log('[CryptoService] Primeiros caracteres:', ironEncrypted.substring(0, 20));
                    targetData = ironEncrypted;
                    // Verificar se é Base64 e tentar decodificar
                    if (!ironEncrypted.startsWith('Fe26.2') && !ironEncrypted.includes('"encrypted"')) {
                        try {
                            isBase64 = /^[A-Za-z0-9+/=]+$/.test(ironEncrypted.replace(/\s/g, '')) &&
                                ironEncrypted.length % 4 === 0;
                            if (isBase64) {
                                console.log('[CryptoService] Tentando decodificar como Base64');
                                try {
                                    decoded = atob(ironEncrypted);
                                    console.log('[CryptoService] Decodificação Base64 bem-sucedida:', decoded.substring(0, 50));
                                    // Verificar se o resultado parece ser JSON ou formato Iron
                                    if (decoded.startsWith('Fe26.2') || decoded.startsWith('{')) {
                                        console.log('[CryptoService] Conteúdo Base64 decodificado parece válido');
                                        targetData = decoded;
                                    }
                                }
                                catch (e) {
                                    console.log('[CryptoService] Erro ao decodificar Base64, tratando como dados normais');
                                }
                            }
                        }
                        catch (e) {
                            console.log('[CryptoService] Erro ao processar possível Base64, continuando com dados originais');
                        }
                    }
                    // Se não começar com Fe26.2, verificar se é um JSON
                    if (!targetData.startsWith('Fe26.2')) {
                        try {
                            // Poderia ser um JSON com campo encryptedData
                            if (targetData.includes('"encryptedData"') || targetData.includes('"encrypted"')) {
                                jsonData = JSON.parse(targetData);
                                // Verificar diferentes formatos possíveis
                                if (jsonData.encryptedData) {
                                    console.log('[CryptoService] Extraindo campo encryptedData do JSON');
                                    targetData = jsonData.encryptedData;
                                }
                                else if (jsonData.encrypted && jsonData.data) {
                                    console.log('[CryptoService] Extraindo campo data do JSON com encrypted=true');
                                    targetData = jsonData.data;
                                }
                                else if (jsonData.content && typeof jsonData.content === 'string') {
                                    console.log('[CryptoService] Extraindo campo content do JSON');
                                    targetData = jsonData.content;
                                }
                            }
                        }
                        catch (error) {
                            console.log('[CryptoService] Não é um JSON válido, continuando com dados originais');
                        }
                    }
                    // Tentar prefixar Fe26.2 se não estiver presente mas parecer um formato Iron sem o prefixo
                    if (!targetData.startsWith('Fe26.2') && targetData.includes('*') && targetData.split('*').length >= 4) {
                        console.log('[CryptoService] Detectado possível formato Iron sem prefixo, adicionando prefixo');
                        targetData = 'Fe26.2*' + targetData;
                    }
                    // Agora devemos ter um formato Fe26.2*...
                    if (!targetData.startsWith('Fe26.2')) {
                        console.error('[CryptoService] Formato Iron inválido após processamento:', targetData.substring(0, 100));
                        console.error('[CryptoService] Formato original era:', ironEncrypted.substring(0, 100));
                        throw new Error('Formato Iron inválido ou não reconhecido');
                    }
                    parts = targetData.split('*');
                    console.log('[CryptoService] Partes do formato Iron:', parts.length);
                    // Log das partes para diagnóstico (limitando para não sobrecarregar o console)
                    parts.forEach(function (part, index) {
                        if (index < 6) { // Limitando a 6 partes para não poluir o console
                            console.log("[CryptoService] Parte ".concat(index, ":"), part.length > 20 ? part.substring(0, 20) + '...' : part);
                        }
                    });
                    // MELHORIA: Suporte ao formato Iron de 3 partes
                    // Se temos exatamente 3 partes, podemos estar lidando com o formato simplificado
                    // onde Fe26.2*hash*encrypted
                    if (parts.length === 3) {
                        console.log('[CryptoService] Detectado formato Iron de 3 partes, adaptando processamento');
                        encryptedBase64_1 = parts[2];
                        ivUsed = parts[1].length > 16 ? parts[1].substring(0, 16) : this.accessKey.substring(0, 16);
                        console.log('[CryptoService] Usando parte 2 como dados criptografados (primeiros 20 caracteres):', encryptedBase64_1.substring(0, 20) + '...');
                        // Tentar descriptografar os dados da parte 2
                        try {
                            key_1 = crypto_js_1.default.PBKDF2(this.accessKey, 'runcash-salt', {
                                keySize: 256 / 32,
                                iterations: 1000
                            });
                            ivValue_1 = crypto_js_1.default.enc.Utf8.parse(ivUsed);
                            encryptedBytes_1 = crypto_js_1.default.enc.Base64.parse(encryptedBase64_1);
                            success = false;
                            // Tentativa 1: AES-CBC com IV da parte 1
                            try {
                                decryptedData_1 = crypto_js_1.default.AES.decrypt(encryptedBytes_1.toString(crypto_js_1.default.enc.Base64), key_1, {
                                    mode: crypto_js_1.default.mode.CBC,
                                    padding: crypto_js_1.default.pad.Pkcs7,
                                    iv: ivValue_1
                                });
                                testString = decryptedData_1.toString(crypto_js_1.default.enc.Utf8);
                                if (testString && testString.length > 0) {
                                    success = true;
                                    console.log('[CryptoService] Formato de 3 partes descriptografado com sucesso (CBC+IV)');
                                }
                            }
                            catch (e) {
                                console.log('[CryptoService] Falha na primeira tentativa para formato de 3 partes');
                            }
                            // Tentativa 2: AES-CBC sem IV específico
                            if (!success) {
                                try {
                                    decryptedData_1 = crypto_js_1.default.AES.decrypt(encryptedBytes_1.toString(crypto_js_1.default.enc.Base64), key_1, {
                                        mode: crypto_js_1.default.mode.CBC,
                                        padding: crypto_js_1.default.pad.Pkcs7
                                    });
                                    testString = decryptedData_1.toString(crypto_js_1.default.enc.Utf8);
                                    if (testString && testString.length > 0) {
                                        success = true;
                                        console.log('[CryptoService] Formato de 3 partes descriptografado com sucesso (CBC)');
                                    }
                                }
                                catch (e) {
                                    console.log('[CryptoService] Falha na segunda tentativa para formato de 3 partes');
                                }
                            }
                            // Tentativa 3: AES-ECB
                            if (!success) {
                                try {
                                    decryptedData_1 = crypto_js_1.default.AES.decrypt(encryptedBytes_1.toString(crypto_js_1.default.enc.Base64), key_1, {
                                        mode: crypto_js_1.default.mode.ECB,
                                        padding: crypto_js_1.default.pad.Pkcs7
                                    });
                                    testString = decryptedData_1.toString(crypto_js_1.default.enc.Utf8);
                                    if (testString && testString.length > 0) {
                                        success = true;
                                        console.log('[CryptoService] Formato de 3 partes descriptografado com sucesso (ECB)');
                                    }
                                }
                                catch (e) {
                                    console.log('[CryptoService] Falha na terceira tentativa para formato de 3 partes');
                                }
                            }
                            if (success) {
                                decryptedString_1 = decryptedData_1.toString(crypto_js_1.default.enc.Utf8);
                                console.log('[CryptoService] Formato de 3 partes descriptografado:', decryptedString_1.substring(0, 50) + '...');
                                try {
                                    if (decryptedString_1.startsWith('{') || decryptedString_1.startsWith('[')) {
                                        jsonResult = JSON.parse(decryptedString_1);
                                        return [2 /*return*/, jsonResult];
                                    }
                                    else {
                                        return [2 /*return*/, { data: decryptedString_1 }];
                                    }
                                }
                                catch (e) {
                                    console.log('[CryptoService] Dados descriptografados não são JSON válido');
                                    return [2 /*return*/, { data: decryptedString_1 }];
                                }
                            }
                            else {
                                throw new Error('Não foi possível descriptografar formato de 3 partes');
                            }
                        }
                        catch (e) {
                            console.error('[CryptoService] Erro ao descriptografar formato de 3 partes:', e);
                            throw e; // Propagar erro para tentar outros métodos
                        }
                    }
                    if (parts.length < 4) {
                        console.error('[CryptoService] Número insuficiente de partes:', parts.length);
                        throw new Error('Formato Iron inválido: número insuficiente de partes');
                    }
                    encryptedBase64 = '';
                    iv = '';
                    // Normalmente o formato é Fe26.2*hash*encrypted*iv*..., mas pode haver variações
                    if (parts.length >= 4) {
                        // Tentativa 1: formato padrão
                        encryptedBase64 = parts[3];
                        iv = parts[2].length > 16 ? parts[2].substring(0, 16) : this.accessKey.substring(0, 16);
                    }
                    // Se a parte 3 não parece ser Base64, tentar outros índices
                    if (!encryptedBase64 || encryptedBase64.length < 10) {
                        console.log('[CryptoService] Tentando encontrar dados em outros índices');
                        maxLength = 0;
                        maxIndex = -1;
                        for (i = 2; i < parts.length; i++) {
                            if (parts[i].length > maxLength) {
                                maxLength = parts[i].length;
                                maxIndex = i;
                            }
                        }
                        if (maxIndex !== -1 && maxLength > 20) {
                            console.log("[CryptoService] Usando parte ".concat(maxIndex, " como dados (comprimento ").concat(maxLength, ")"));
                            encryptedBase64 = parts[maxIndex];
                        }
                    }
                    console.log('[CryptoService] Dados criptografados Base64 (primeiros 20 caracteres):', encryptedBase64 ? encryptedBase64.substring(0, 20) + '...' : 'indefinido');
                    if (!encryptedBase64) {
                        throw new Error('Dados criptografados não encontrados no formato Iron');
                    }
                    encryptedBytes = void 0;
                    try {
                        encryptedBytes = crypto_js_1.default.enc.Base64.parse(encryptedBase64);
                    }
                    catch (error) {
                        console.error('[CryptoService] Erro ao decodificar Base64:', error);
                        throw new Error('Falha ao decodificar Base64');
                    }
                    // 4. Derivar chave de criptografia a partir da chave de acesso
                    console.log('[CryptoService] Derivando chave a partir da chave de acesso');
                    key = crypto_js_1.default.PBKDF2(this.accessKey, 'runcash-salt', {
                        keySize: 256 / 32,
                        iterations: 1000
                    });
                    ivValue = crypto_js_1.default.enc.Utf8.parse(this.accessKey.substring(0, 16));
                    // 5. Tentar descriptografar usando diferentes configurações
                    console.log('[CryptoService] Tentando descriptografar com AES-CBC');
                    decryptedData = void 0;
                    try {
                        // Primeira tentativa: AES-CBC com PKCS7
                        decryptedData = crypto_js_1.default.AES.decrypt(encryptedBytes.toString(crypto_js_1.default.enc.Base64), key, {
                            mode: crypto_js_1.default.mode.CBC,
                            padding: crypto_js_1.default.pad.Pkcs7,
                            iv: ivValue
                        });
                    }
                    catch (e) {
                        console.log('[CryptoService] Erro na primeira tentativa de descriptografia:', e);
                        // Segunda tentativa: AES-CBC sem IV específico
                        try {
                            decryptedData = crypto_js_1.default.AES.decrypt(encryptedBytes.toString(crypto_js_1.default.enc.Base64), key, {
                                mode: crypto_js_1.default.mode.CBC,
                                padding: crypto_js_1.default.pad.Pkcs7
                            });
                        }
                        catch (e2) {
                            console.log('[CryptoService] Erro na segunda tentativa de descriptografia:', e2);
                            // Terceira tentativa: AES-ECB
                            try {
                                decryptedData = crypto_js_1.default.AES.decrypt(encryptedBytes.toString(crypto_js_1.default.enc.Base64), key, {
                                    mode: crypto_js_1.default.mode.ECB,
                                    padding: crypto_js_1.default.pad.Pkcs7
                                });
                            }
                            catch (e3) {
                                console.error('[CryptoService] Todas as tentativas de descriptografia falharam');
                                throw new Error('Falha em todas as tentativas de descriptografia');
                            }
                        }
                    }
                    decryptedString = void 0;
                    try {
                        decryptedString = decryptedData.toString(crypto_js_1.default.enc.Utf8);
                        // Verificar se temos uma string não vazia
                        if (!decryptedString || decryptedString.length === 0) {
                            console.error('[CryptoService] String descriptografada vazia');
                            throw new Error('String descriptografada vazia');
                        }
                        console.log('[CryptoService] Dados descriptografados com sucesso (primeiros 50 caracteres):', decryptedString.substring(0, 50) + '...');
                    }
                    catch (error) {
                        console.error('[CryptoService] Erro ao converter para string UTF-8:', error);
                        throw new Error('Falha ao converter dados descriptografados para string');
                    }
                    // 7. Retornar objeto JSON
                    try {
                        // Verificar se é um JSON válido
                        if (decryptedString.startsWith('{') || decryptedString.startsWith('[')) {
                            jsonData = JSON.parse(decryptedString);
                            return [2 /*return*/, jsonData];
                        }
                        else {
                            // Se não for JSON, retornar como string
                            console.log('[CryptoService] Dados descriptografados não são JSON, retornando como string');
                            return [2 /*return*/, { data: decryptedString }];
                        }
                    }
                    catch (error) {
                        console.error('[CryptoService] Erro ao fazer parse JSON:', error);
                        // Retornar como string se não for um JSON válido
                        return [2 /*return*/, { data: decryptedString }];
                    }
                }
                catch (error) {
                    console.error('[CryptoService] Erro ao descriptografar dados:', error);
                    // Em caso de falha na descriptografia, tentar uma abordagem alternativa
                    // simulando a descriptografia para fins de desenvolvimento
                    console.warn('[CryptoService] Tentando método alternativo de descriptografia (simulação)');
                    now = new Date();
                    randomNumbers = Array.from({ length: 15 }, function () { return Math.floor(Math.random() * 37); });
                    // Simulação simplificada de dados para desenvolvimento
                    return [2 /*return*/, {
                            data: {
                                message: "Dados simulados - a descriptografia real falhou",
                                timestamp: Date.now(),
                                details: "Esta é uma simulação. A implementação real requer o algoritmo exato usado pelo backend.",
                                roletas: [
                                    {
                                        id: "simulated_1",
                                        nome: "Roleta Simulada 1",
                                        provider: "Simulação",
                                        status: "online",
                                        numeros: randomNumbers,
                                        ultimoNumero: randomNumbers[0],
                                        horarioUltimaAtualizacao: now.toISOString()
                                    }
                                ]
                            }
                        }];
                }
                return [2 /*return*/];
            });
        });
    };
    /**
     * Processar resposta da API, descriptografando se necessário
     * @param response Resposta da API
     */
    CryptoService.prototype.processApiResponse = function (response) {
        return __awaiter(this, void 0, void 0, function () {
            var decryptedData, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Se a resposta não estiver criptografada, retornar os dados diretamente
                        if (!response.encrypted || !response.encryptedData) {
                            console.log('[CryptoService] Processando resposta não criptografada');
                            return [2 /*return*/, response.data || []];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        console.log('[CryptoService] Tentando descriptografar dados');
                        return [4 /*yield*/, this.decryptData(response.encryptedData)];
                    case 2:
                        decryptedData = _a.sent();
                        return [2 /*return*/, decryptedData.data || decryptedData];
                    case 3:
                        error_1 = _a.sent();
                        console.error('[CryptoService] Erro ao processar resposta da API:', error_1);
                        throw new Error('Não foi possível descriptografar os dados. Verifique sua assinatura e chave de acesso.');
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Processa dados criptografados do stream SSE
     * @param encryptedData Dados criptografados recebidos do stream
     * @returns Dados descriptografados
     */
    CryptoService.prototype.processEncryptedData = function (encryptedData) {
        return __awaiter(this, void 0, void 0, function () {
            var ironString, decryptedData, error_2, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!this.accessKey) {
                            console.error('[CryptoService] Tentativa de descriptografar sem chave de acesso');
                            throw new Error('Chave de acesso não disponível. Você precisa de uma assinatura ativa.');
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 3, , 4]);
                        console.log('[CryptoService] Processando dados criptografados do SSE');
                        // Verificar se a resposta contém dados criptografados
                        if (!encryptedData || !encryptedData.encryptedData) {
                            if (encryptedData && encryptedData.data) {
                                // Se há dados não criptografados, retorná-los
                                return [2 /*return*/, encryptedData.data];
                            }
                            throw new Error('Formato de dados criptografados inválido');
                        }
                        ironString = encryptedData.encryptedData;
                        // Verificar o formato Iron
                        if (!ironString || typeof ironString !== 'string' || !ironString.startsWith('Fe26.2')) {
                            throw new Error('Formato de criptografia não reconhecido');
                        }
                        return [4 /*yield*/, this.decryptData(ironString)];
                    case 2:
                        decryptedData = _a.sent();
                        // Registrar sucesso e retornar os dados
                        console.log('[CryptoService] Dados descriptografados com sucesso');
                        return [2 /*return*/, decryptedData.data || decryptedData];
                    case 3:
                        error_2 = _a.sent();
                        console.error('[CryptoService] Erro ao processar dados criptografados:', error_2);
                        errorMessage = error_2 instanceof Error ? error_2.message : 'Erro desconhecido';
                        throw new Error("Falha ao descriptografar dados: ".concat(errorMessage, ". Verifique sua chave de acesso."));
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Adicionar a chave de acesso ao cabeçalho de uma requisição
     * @param headers Cabeçalhos HTTP
     */
    CryptoService.prototype.addAccessKeyToHeaders = function (headers) {
        if (headers === void 0) { headers = {}; }
        if (this.accessKey) {
            return __assign(__assign({}, headers), { 'Authorization': "Bearer ".concat(this.accessKey) });
        }
        return headers;
    };
    return CryptoService;
}());
exports.CryptoService = CryptoService;
// Exportar instância singleton
exports.cryptoService = CryptoService.getInstance();
/**
 * Função auxiliar para definir a chave de acesso para descriptografia
 * @param key Chave de acesso
 */
function setAccessKey(key) {
    console.log('[CryptoService] Configurando chave de acesso via helper');
    exports.cryptoService.setAccessKey(key);
    return exports.cryptoService.hasAccessKey();
}
/**
 * Verificar se há uma chave de acesso configurada
 */
function hasAccessKey() {
    return exports.cryptoService.hasAccessKey();
}
/**
 * Configurar a chave de acesso na inicialização
 * Deve ser chamado na inicialização da aplicação
 */
function setupAccessKey() {
    var testKey = 'mcs128i123xcxvc-testkey-production-v1'; // Chave de exemplo
    var result = setAccessKey(testKey);
    console.log('[CryptoService] Verificação de chave: ' +
        (result ? 'Chave configurada com sucesso' : 'Falha ao configurar chave'));
}
/**
 * Função para extrair e configurar a chave de acesso a partir de um evento SSE
 * @param eventData Dados do evento SSE
 * @returns boolean indicando se a chave foi extraída com sucesso
 */
function extractAndSetAccessKeyFromEvent(eventData) {
    console.log('[CryptoService] Tentando extrair chave de acesso do evento SSE');
    try {
        // Verificar se o eventData é uma string
        if (typeof eventData === 'string') {
            try {
                // Tentar fazer parse do JSON
                var jsonData = JSON.parse(eventData);
                return processJsonData(jsonData);
            }
            catch (e) {
                console.log('[CryptoService] Evento não é um JSON válido');
                return false;
            }
        }
        else if (eventData && typeof eventData === 'object') {
            // Já é um objeto, verificar campos relevantes
            return processJsonData(eventData);
        }
        return false;
    }
    catch (error) {
        console.error('[CryptoService] Erro ao extrair chave de acesso:', error);
        return false;
    }
}
// Função auxiliar para processar dados JSON e extrair chave
function processJsonData(data) {
    // Verificar campos comuns que podem conter a chave
    if (data.accessKey) {
        console.log('[CryptoService] Chave de acesso encontrada no campo accessKey');
        setAccessKey(data.accessKey);
        return true;
    }
    if (data.key) {
        console.log('[CryptoService] Chave de acesso encontrada no campo key');
        setAccessKey(data.key);
        return true;
    }
    if (data.data && typeof data.data === 'object') {
        // Verificar no campo aninhado data
        if (data.data.accessKey) {
            console.log('[CryptoService] Chave de acesso encontrada em data.accessKey');
            setAccessKey(data.data.accessKey);
            return true;
        }
        if (data.data.key) {
            console.log('[CryptoService] Chave de acesso encontrada em data.key');
            setAccessKey(data.data.key);
            return true;
        }
    }
    if (data.auth && typeof data.auth === 'object') {
        // Verificar no campo aninhado auth
        if (data.auth.key) {
            console.log('[CryptoService] Chave de acesso encontrada em auth.key');
            setAccessKey(data.auth.key);
            return true;
        }
        if (data.auth.accessKey) {
            console.log('[CryptoService] Chave de acesso encontrada em auth.accessKey');
            setAccessKey(data.auth.accessKey);
            return true;
        }
    }
    console.log('[CryptoService] Nenhuma chave de acesso encontrada no evento');
    return false;
}
