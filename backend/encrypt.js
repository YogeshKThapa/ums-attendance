const CryptoJS = require("crypto-js");

const password = process.argv[2];
const keyReq = process.argv[3];

if (!password || !keyReq) {
    console.error("Usage: node encrypt.js <password> <key>");
    process.exit(1);
}

function encriptdataAES(keyReq, ValueToEnc) {
    var key = CryptoJS.enc.Utf8.parse(keyReq);
    var iv = CryptoJS.enc.Utf8.parse(keyReq);

    var encryptedData = CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(ValueToEnc), key,
        {
            keySize: 128 / 8,
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
        });

    return encryptedData.toString();
}

console.log(encriptdataAES(keyReq, password));
