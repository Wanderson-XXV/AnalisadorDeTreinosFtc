import type { Config } from "@react-router/dev/config";
import { loadEnv } from "vite";
import { normalizeRouterBasename } from "./deployPaths";

const mode = process.env.NODE_ENV === "production" ? "production" : "development";
const env = loadEnv(mode, process.cwd(), "");

export default {
  ssr: false,
  basename: normalizeRouterBasename(env.VITE_BASE_PATH),
} satisfies Config;
