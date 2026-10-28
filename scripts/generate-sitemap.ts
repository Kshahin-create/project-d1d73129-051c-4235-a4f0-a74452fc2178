import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PUBLIC_PAGES, SITE_URL } from "../src/lib/seo";

// No lastmod: there are no authoritative per-page content timestamps.
const urls = PUBLIC_PAGES.map((page) => `  <url><loc>${SITE_URL}${page.path}</loc></url>`);
writeFileSync(resolve("public/sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
console.log(`Sitemap contains ${urls.length} public pages.`);