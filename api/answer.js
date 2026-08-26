const tls = require("tls");
const net = require("net");
const path = require("path");
const loadEnvLocal = require("../loadEnvLocal");

loadEnvLocal(path.join(__dirname, ".."));

const MAIL_CONFIG = {
    recipientEmail: process.env.RECIPIENT_EMAIL || "your-email@example.com",
    fromEmail: process.env.FROM_EMAIL || "proposal-site@example.com",
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 465),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
    secure: process.env.SMTP_SECURE !== "false"
};

function sendJson(response, statusCode, payload) {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Cache-Control", "no-store");
    response.end(JSON.stringify(payload));
}

function collectJson(request) {
    return new Promise((resolve, reject) => {
        let raw = "";

        request.on("data", (chunk) => {
            raw += chunk;

            if (raw.length > 100_000) {
                reject(new Error("Request body is too large."));
                request.destroy();
            }
        });

        request.on("end", () => {
            try {
                resolve(JSON.parse(raw || "{}"));
            } catch (error) {
                reject(new Error("Invalid JSON."));
            }
        });

        request.on("error", reject);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function createEmail({ answer, name, message, createdAt }) {
    const safeAnswer = answer || "Unknown";
    const safeName = name || "_____";
    const safeMessage = message || "The answer is.....";
    const safeDate = createdAt || new Date().toISOString();

    return {
        subject: `_____ - ${safeAnswer}`,
        text: [
            "_____",
            "",
            `Answer: ${safeAnswer}`,
            `Name: ${safeName}`,
            `Time: ${safeDate}`,
            "",
            safeMessage
        ].join("\n"),
        html: [
            "<main>",
            "<h1>_____</h1>",
            `<p><strong>Answer:</strong> ${escapeHtml(safeAnswer)}</p>`,
            `<p><strong>Name:</strong> ${escapeHtml(safeName)}</p>`,
            `<p><strong>Time:</strong> ${escapeHtml(safeDate)}</p>`,
            `<p>${escapeHtml(safeMessage)}</p>`,
            "</main>"
        ].join("")
    };
}

function smtpEncode(value) {
    return Buffer.from(String(value), "utf8").toString("base64");
}

function dotStuff(value) {
    return String(value).replace(/^\./gm, "..");
}

function createSmtpClient() {
    const socket = MAIL_CONFIG.secure
        ? tls.connect(MAIL_CONFIG.smtpPort, MAIL_CONFIG.smtpHost, { servername: MAIL_CONFIG.smtpHost })
        : net.connect(MAIL_CONFIG.smtpPort, MAIL_CONFIG.smtpHost);

    socket.setEncoding("utf8");

    let buffer = "";

    function readResponse() {
        return new Promise((resolve, reject) => {
            const onData = (chunk) => {
                buffer += chunk;
                const lines = buffer.split(/\r?\n/).filter(Boolean);
                const lastLine = lines.at(-1);

                if (lastLine && /^\d{3} /.test(lastLine)) {
                    cleanup();
                    const response = buffer;
                    buffer = "";
                    resolve(response);
                }
            };

            const onError = (error) => {
                cleanup();
                reject(error);
            };

            const cleanup = () => {
                socket.off("data", onData);
                socket.off("error", onError);
            };

            socket.on("data", onData);
            socket.on("error", onError);
        });
    }

    async function command(value) {
        socket.write(`${value}\r\n`);
        const response = await readResponse();

        if (!/^[23]\d{2}/.test(response)) {
            throw new Error(`SMTP rejected command: ${value}`);
        }

        return response;
    }

    return { socket, readResponse, command };
}

async function sendMail(email) {
    if (!MAIL_CONFIG.smtpHost || !MAIL_CONFIG.smtpUser || !MAIL_CONFIG.smtpPass) {
        console.log("SMTP is not configured. Submission received:", {
            recipientEmail: MAIL_CONFIG.recipientEmail,
            subject: email.subject,
            text: email.text
        });

        return { sent: false, configured: false };
    }

    const client = createSmtpClient();

    try {
        await client.readResponse();
        await client.command("EHLO localhost");
        await client.command("AUTH LOGIN");
        await client.command(smtpEncode(MAIL_CONFIG.smtpUser));
        await client.command(smtpEncode(MAIL_CONFIG.smtpPass));
        await client.command(`MAIL FROM:<${MAIL_CONFIG.fromEmail}>`);
        await client.command(`RCPT TO:<${MAIL_CONFIG.recipientEmail}>`);
        await client.command("DATA");

        const rawEmail = [
            `From: ${MAIL_CONFIG.fromEmail}`,
            `To: ${MAIL_CONFIG.recipientEmail}`,
            `Subject: ${email.subject}`,
            "MIME-Version: 1.0",
            "Content-Type: multipart/alternative; boundary=\"proposal-boundary\"",
            "",
            "--proposal-boundary",
            "Content-Type: text/plain; charset=utf-8",
            "",
            email.text,
            "",
            "--proposal-boundary",
            "Content-Type: text/html; charset=utf-8",
            "",
            email.html,
            "",
            "--proposal-boundary--",
            "."
        ].join("\r\n");

        await client.command(dotStuff(rawEmail));
        await client.command("QUIT");
        return { sent: true, configured: true };
    } finally {
        client.socket.end();
    }
}

module.exports = async function handler(request, response) {
    if (request.method !== "POST") {
        sendJson(response, 405, {
            ok: false,
            message: "Method not allowed."
        });
        return;
    }

    try {
        const payload = await collectJson(request);
        const email = createEmail(payload);
        const result = await sendMail(email);

        sendJson(response, 200, {
            ok: true,
            message: result.sent ? "Email sent." : "SMTP not configured. Submission received.",
            result
        });
    } catch (error) {
        console.error(error);
        const message = /auth|login|535|534|534-5\.7\.9|username and password not accepted/i.test(
            String(error && error.message ? error.message : error)
        )
            ? "SMTP login failed. Check SMTP_USER and SMTP_PASS."
            : "Could not send the answer right now.";
        sendJson(response, 500, {
            ok: false,
            message
        });
    }
};
