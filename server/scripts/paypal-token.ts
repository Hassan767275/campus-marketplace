// Checks the PayPal REST credentials in server/.env by requesting an OAuth
// access token (client_credentials grant). Prints success or PayPal's error.
//
// Never prints the client secret or the access token itself.
//
// Run from server/:  npm run paypal:token

import "dotenv/config";

const SANDBOX_URL = "https://api-m.sandbox.paypal.com";

type TokenResponse = {
    access_token: string;
    token_type: string;
    app_id?: string;
    expires_in: number;
    scope?: string;
};

type ErrorResponse = { error?: string; error_description?: string };

function fail(message: string): never {
    console.error(`PayPal token test FAILED: ${message}`);
    process.exit(1);
}

async function main() {
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    const baseUrl = (process.env.PAYPAL_BASE_URL?.trim() || SANDBOX_URL).replace(/\/+$/, "");

    const missing = [
        !clientId && "PAYPAL_CLIENT_ID",
        !clientSecret && "PAYPAL_CLIENT_SECRET",
    ].filter(Boolean);
    if (missing.length) fail(`missing ${missing.join(" and ")} in server/.env`);

    // Only the start of the client ID is shown; it identifies the app without exposing it.
    console.log(`Requesting token from ${baseUrl} (client ID ${clientId!.slice(0, 6)}...)`);
    if (!baseUrl.includes("sandbox")) {
        console.warn("Warning: PAYPAL_BASE_URL is not the sandbox URL.");
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    let res: Response;
    try {
        res = await fetch(`${baseUrl}/v1/oauth2/token`, {
            method: "POST",
            headers: {
                Authorization: `Basic ${credentials}`,
                "Content-Type": "application/x-www-form-urlencoded",
                Accept: "application/json",
            },
            body: "grant_type=client_credentials",
            signal: AbortSignal.timeout(15_000),
        });
    } catch (err) {
        // fetch wraps the real reason (ENOTFOUND, ECONNREFUSED, timeout) in err.cause.
        const cause = (err as { cause?: { code?: string; message?: string } })?.cause;
        const reason = cause?.code ?? cause?.message ?? (err instanceof Error ? err.message : String(err));
        fail(`could not reach ${baseUrl} (${reason}). Check PAYPAL_BASE_URL and your connection.`);
    }

    const text = await res.text();
    let body: unknown;
    try {
        body = JSON.parse(text);
    } catch {
        body = undefined;
    }

    if (!res.ok) {
        const e = (body ?? {}) as ErrorResponse;
        const detail = e.error
            ? `${e.error}${e.error_description ? `: ${e.error_description}` : ""}`
            : text.slice(0, 200) || "(empty response)";
        const hint =
            res.status === 401
                ? " Check that the client ID and secret are from the same Sandbox app, with no extra spaces."
                : "";
        fail(`HTTP ${res.status} ${detail}.${hint}`);
    }

    const token = body as TokenResponse;
    if (!token?.access_token) fail("response had no access_token");

    console.log("PayPal token test OK");
    console.log(`  token type:  ${token.token_type}`);
    console.log(`  expires in:  ${Math.round(token.expires_in / 60)} min`);
    if (token.app_id) console.log(`  app id:      ${token.app_id}`);
    if (token.scope) console.log(`  scopes:      ${token.scope.split(" ").length}`);
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));