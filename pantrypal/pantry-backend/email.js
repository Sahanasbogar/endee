const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT || 587);
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) {
        console.log('[Email] Missing EMAIL_USER / EMAIL_PASS — emails will not be sent.');
        return null;
    }
    transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
    return transporter;
}

async function sendEmail(to, subject, text) {
    try {
        const t = getTransporter();
        if (!t || !to) {
            console.log(`[Email not sent] To ${to || 'N/A'}: ${subject}`);
            return { ok: false };
        }
        const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
        await t.sendMail({ from, to, subject, text });
        console.log(`📧 Email sent to ${to}`);
        return { ok: true };
    } catch (e) {
        console.error('Email error:', e.message);
        return { ok: false };
    }
}

module.exports = { sendEmail };

