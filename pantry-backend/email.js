const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT || 587);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    if (!user || !pass) {
        console.warn('⚠️ [Email Service] Missing EMAIL_USER or EMAIL_PASS in .env — Emails will be skipped.');
        return null;
    }

    try {
        transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for other ports
            auth: { user, pass },
            tls: {
                rejectUnauthorized: false // Helps avoid local/Render cert issues,
            }
        });
        console.log(`✉️ [Email Service] Configured with ${host}:${port} as ${user}`);
    } catch (e) {
        console.error('❌ [Email Service] Failed to configure transport:', e.message);
    }

    return transporter;
}

async function sendEmail(to, subject, text, retries = 2) {
    try {
        const t = getTransporter();
        if (!t || !to) {
            console.log(`[Email Skipped] Missing configuration or recipient (${to || 'N/A'}) for: ${subject}`);
            return { ok: false };
        }

        const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

        console.log(`[Email] Attempting to send to ${to}...`);

        const info = await t.sendMail({ from, to, subject, text });
        console.log(`✅ [Email Success] Sent carefully to ${to}. MessageId: ${info.messageId}`);
        return { ok: true, messageId: info.messageId };

    } catch (e) {
        console.error(`❌ [Email Error] Failed sending to ${to}:`, e.message);

        if (retries > 0) {
            console.log(`🔄 [Email Retry] Retrying... (${retries} attempts left)`);
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            return sendEmail(to, subject, text, retries - 1);
        }

        return { ok: false, error: e.message };
    }
}

module.exports = { sendEmail };

