const http = require("http");
const fs = require("fs");
const path = require("path");
const loadEnvLocal = require("./loadEnvLocal");

loadEnvLocal(__dirname);

const answerHandler = require("./api/answer");

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp"
};

function serveStatic(request, response) {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);
    const cleanPath = decodeURIComponent(requestUrl.pathname === "/" ? "/index.html" : requestUrl.pathname);
    const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));

    if (!filePath.startsWith(PUBLIC_DIR)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            response.writeHead(404);
            response.end("Not found");
            return;
        }

        const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
        response.writeHead(200, { "Content-Type": contentType });
        response.end(content);
    });
}

const server = http.createServer((request, response) => {
    if (request.url === "/api/answer") {
        answerHandler(request, response);
        return;
    }

    if (request.method === "GET") {
        serveStatic(request, response);
        return;
    }

    response.writeHead(405);
    response.end("Method not allowed");
});

server.listen(PORT, () => {
    console.log(`Proposal site running at http://localhost:${PORT}`);
});
