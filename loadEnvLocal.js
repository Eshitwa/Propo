const fs = require("fs");
const path = require("path");

function parseEnvContent(content) {
  const env = {};
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (!key) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function loadEnvLocal(baseDir) {
  const envPath = path.join(baseDir, ".env.local");

  if (!fs.existsSync(envPath)) {
    return false;
  }

  const parsed = parseEnvContent(fs.readFileSync(envPath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }

  return true;
}

module.exports = loadEnvLocal;
