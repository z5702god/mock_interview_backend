const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration
const CONFIG = {
    MerchantID: process.env.MERCHANT_ID,
    HashKey: process.env.HASH_KEY,
    HashIV: process.env.HASH_IV,
    ReturnURL: process.env.RETURN_URL, // e.g., https://your-site.netlify.app/interview.html
    NotifyURL: process.env.NOTIFY_URL,
    Version: '2.0'
};

// Helper: Encrypt AES-256-CBC
function encrypt(data) {
    const cipher = crypto.createCipheriv('aes-256-cbc', CONFIG.HashKey, CONFIG.HashIV);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted.toUpperCase();
}

// Helper: Hash SHA256
function hash(data) {
    const sha = crypto.createHash('sha256');
    sha.update(data);
    return sha.digest('hex').toUpperCase();
}

// Helper: Generate TradeInfo String
function createTradeInfoString(data) {
    const params = [
        ['MerchantID', CONFIG.MerchantID],
        ['RespondType', 'JSON'],
        ['TimeStamp', data.TimeStamp],
        ['Version', CONFIG.Version],
        ['MerchantOrderNo', data.MerchantOrderNo],
        ['Amt', data.Amt],
        ['ItemDesc', data.ItemDesc],
        ['ReturnURL', CONFIG.ReturnURL],
        ['NotifyURL', CONFIG.NotifyURL],
        ['Email', data.Email],
        ['LoginType', 0],
        ['CREDIT', 1], // Enable Credit Card
        ['WEBATM', 1], // Enable WebATM
        ['VACC', 1]    // Enable ATM
    ];

    // Filter out undefined/null values
    const searchParams = new URLSearchParams();
    params.forEach(([key, value]) => {
        if (value) searchParams.append(key, value);
    });

    return searchParams.toString();
}

/**
 * API: Create Payment Data
 * POST /api/create-payment
 * Body: { amount, email, itemDesc }
 */
app.post('/api/create-payment', (req, res) => {
    try {
        const { amount, email, itemDesc, sessionId } = req.body;

        if (!amount || !email) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const timeStamp = Math.round(new Date().getTime() / 1000);
        const orderNo = sessionId || `ORD${timeStamp}`; // Use SessionID as OrderNo if provided

        const tradeData = {
            MerchantID: CONFIG.MerchantID,
            TimeStamp: timeStamp,
            MerchantOrderNo: orderNo,
            Amt: amount,
            ItemDesc: itemDesc || 'Mock Interview Analysis',
            Email: email
        };

        // 1. Generate Query String
        const tradeInfoString = createTradeInfoString(tradeData);
        console.log('Trade String:', tradeInfoString);

        // 2. Encrypt TradeInfo (AES)
        const encryptedTradeInfo = encrypt(tradeInfoString);

        // 3. Generate TradeSha (HashKey + TradeInfo + HashIV -> SHA256)
        const shaString = `HashKey=${CONFIG.HashKey}&${encryptedTradeInfo}&HashIV=${CONFIG.HashIV}`;
        const tradeSha = hash(shaString);

        // Return data for frontend form
        res.json({
            MerchantID: CONFIG.MerchantID,
            TradeInfo: encryptedTradeInfo,
            TradeSha: tradeSha,
            Version: CONFIG.Version,
            MerchantOrderNo: orderNo
        });

    } catch (error) {
        console.error('Payment Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Health Check
app.get('/', (req, res) => {
    res.send('Payment Server is running');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
