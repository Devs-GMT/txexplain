import { defineConfig } from "vite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// /app and /tx/:hash serve app.html in dev, the same way vercel.json does in production.
const appRoutes = () => ({
  name: "app-routes",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const path = (req.url ?? "").split("?")[0];
      if (path === "/app" || path.startsWith("/tx/")) req.url = "/app.html";
      next();
    });
  },
});

// vercel.json is the single source for security headers. `vite preview` applies the same ones so the built site
// can be tested locally; the dev server does not, because Vite's own hot-reload client needs inline script.
const securityHeaders = () => ({
  name: "security-headers",
  configurePreviewServer(server) {
    const rules = JSON.parse(readFileSync("vercel.json", "utf8")).headers.filter((r) => r.source === "/(.*)");
    server.middlewares.use((req, res, next) => {
      for (const rule of rules) for (const { key, value } of rule.headers) res.setHeader(key, value);
      const path = (req.url ?? "").split("?")[0];
      if (path === "/app" || path.startsWith("/tx/")) req.url = "/app.html";
      next();
    });
  },
});

// The header and footer are written once, in src/ui, and put into the HTML here. The page arrives with them already in place,
// so nothing pops in when the scripts start.
const prerenderChrome = () => ({
  name: "prerender-chrome",
  async transformIndexHtml(html) {
    const load = (file) => import(`${pathToFileURL(resolve(file)).href}?t=${Date.now()}`);
    const [{ announcement, navbar }, { footer }] = await Promise.all([load("src/ui/header.js"), load("src/ui/footer.js")]);
    return html
      .replace("<div id=\"site-header\"></div>", `<div id="site-header">${announcement}${navbar}</div>`)
      .replace("<div id=\"site-footer\"></div>", `<div id="site-footer">${footer}</div>`);
  },
});

export default defineConfig({
  plugins: [appRoutes(), securityHeaders(), prerenderChrome()],
  build: {
    rollupOptions: { input: { site: resolve("index.html"), app: resolve("app.html") } },
  },
});
