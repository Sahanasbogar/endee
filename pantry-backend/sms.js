function normalizePhone(phone) {
    if (phone === undefined || phone === null) return '';
    const digits = String(phone).replace(/\D/g, '');
    return digits.length >= 10 ? digits.slice(-10) : digits;
}

let twilioClient = null;
try {
    const twilio = require('twilio');
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
} catch (e) { /* twilio not installed */ }

async function sendViaFast2SMS(num, body) {
    const key = process.env.FAST2SMS_API_KEY;
    if (!key) return false;
    const url = new URL('https://www.fast2sms.com/dev/bulkV2');
    url.searchParams.set('message', body);
    url.searchParams.set('route', 'q');
    url.searchParams.set('numbers', num);
    // Extra details help debugging and delivery confirmation
    url.searchParams.set('sms_details', '1');

    const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            // Fast2SMS supports authorization via header; keep it here for reliability
            authorization: key,
            accept: 'application/json'
        }
    });

    let data = null;
    try {
        data = await res.json();
    } catch (e) {
        const text = await res.text().catch(() => '');
        console.error('Fast2SMS error: non-JSON response', res.status, text.slice(0, 200));
        return false;
    }
    if (data.return) {
        console.log(`📱 SMS sent to ${num} (Fast2SMS)`);
        return true;
    }
    const msg = Array.isArray(data.message) ? data.message.join(' ') : (data.message || data);
    if (typeof msg === 'string' && msg.toLowerCase().includes('transaction of 100')) {
        console.error('Fast2SMS error: Your Fast2SMS account must complete a ₹100+ recharge/transaction before Dev API route works.');
    } else {
        console.error('Fast2SMS error:', msg);
    }
    return false;
}

async function sendSMS(to, body) {
    try {
        const num = normalizePhone(to);
        if (!num || num.length < 10) {
            console.warn('SMS skipped: invalid number', to);
            return { ok: false };
        }
        const e164 = `+91${num}`;
        // 1. Try Twilio
        const from = process.env.TWILIO_PHONE_NUMBER;
        if (twilioClient && from) {
            await twilioClient.messages.create({ body, from, to: e164 });
            console.log(`📱 SMS sent to ${e164} (Twilio)`);
            return { ok: true };
        }
        // 2. Try Fast2SMS (India - free credits)
        if (process.env.FAST2SMS_API_KEY) {
            const ok = await sendViaFast2SMS(num, body);
            return { ok };
        }
        // 3. No provider configured - log only
        console.log(`📱 [SMS not sent - add TWILIO or FAST2SMS_API_KEY] To ${e164}: ${body.slice(0, 50)}...`);
        return { ok: false };
    } catch (e) {
        console.error('SMS error:', e.message);
        return { ok: false };
    }
}

module.exports = { sendSMS, normalizePhone };
