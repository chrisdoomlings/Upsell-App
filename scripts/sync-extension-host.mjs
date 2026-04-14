import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const envFiles = [".env", ".env.local", ".env.development.local"];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadEnvValue() {
  const fileValues = {};
  for (const envFile of envFiles) {
    Object.assign(fileValues, parseEnvFile(path.join(rootDir, envFile)));
  }

  const resolved =
    process.env.SHOPIFY_EXTENSION_APP_URL ||
    fileValues.SHOPIFY_EXTENSION_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    fileValues.NEXT_PUBLIC_APP_URL ||
    process.env.HOST ||
    fileValues.HOST;

  if (!resolved) {
    throw new Error(
      "Missing extension app URL. Set SHOPIFY_EXTENSION_APP_URL, NEXT_PUBLIC_APP_URL, or HOST.",
    );
  }

  return resolved.replace(/\/$/, "");
}

const appUrl = loadEnvValue();

const replacements = [
  {
    file: "extensions/upsell-widget/blocks/upsell.liquid",
    pattern: /var apiBase = 'https:\/\/[^']+';/,
    replacement: `var apiBase = '${appUrl}';`,
  },
  {
    file: "extensions/upsell-widget/blocks/cart-upsell.liquid",
    pattern: /var apiBase = 'https:\/\/[^']+';/,
    replacement: `var apiBase = '${appUrl}';`,
  },
  {
    file: "extensions/upsell-widget/blocks/cart-limits-guard.liquid",
    pattern: /data-api-base="https:\/\/[^"]+"/,
    replacement: `data-api-base="${appUrl}"`,
  },
  {
    file: "extensions/upsell-widget/blocks/bundle-offers.liquid",
    pattern: /data-api-base="https:\/\/[^"]+"/,
    replacement: `data-api-base="${appUrl}"`,
  },
  {
    file: "extensions/upsell-widget/blocks/gift-notification.liquid",
    pattern: /data-api-base="https:\/\/[^"]+"/,
    replacement: `data-api-base="${appUrl}"`,
  },
  {
    file: "extensions/upsell-widget/blocks/geo-countdown.liquid",
    pattern: /data-api-base="https:\/\/[^"]+"/,
    replacement: `data-api-base="${appUrl}"`,
  },
  {
    file: "extensions/upsell-widget/blocks/custom-cursor.liquid",
    pattern: /data-api-base="https:\/\/[^"]+"/,
    replacement: `data-api-base="${appUrl}"`,
  },
  {
    file: "extensions/post-purchase-offer/src/index.js",
    pattern: /const APP_URL = "https:\/\/[^"]+";/,
    replacement: `const APP_URL = "${appUrl}";`,
  },
];

for (const item of replacements) {
  const filePath = path.join(rootDir, item.file);
  const source = fs.readFileSync(filePath, "utf8");

  if (!item.pattern.test(source)) {
    throw new Error(`Could not find URL pattern in ${item.file}`);
  }

  const next = source.replace(item.pattern, item.replacement);
  if (next !== source) {
    fs.writeFileSync(filePath, next, "utf8");
  }
}

console.log(`Synced extension host to ${appUrl}`);
