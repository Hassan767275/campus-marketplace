import "dotenv/config";
import { createApp } from "./app.js";
import { getAuthConfig } from "./auth/config.js";

// Fail fast on missing auth settings instead of on the first login.
getAuthConfig();

const app = createApp();

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => console.log(`Server on http://localhost:${port}`));