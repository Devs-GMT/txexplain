import { defineConfig } from "vite";
import { resolve } from "node:path";

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

export default defineConfig({
  plugins: [appRoutes()],
  build: {
    rollupOptions: { input: { site: resolve("index.html"), app: resolve("app.html") } },
  },
});
