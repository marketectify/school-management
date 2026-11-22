import { OAuth2Client } from "google-auth-library";
export function applicationOrigin(env = process.env) {
  const url = new URL(
    env.APP_URL ||
      (env.NODE_ENV === "production"
        ? "https://school-management.marketectify.com"
        : "http://localhost:4000"),
  );
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("APP_URL must use HTTPS.");
  return url.origin;
}
export function googleConfigured(env = process.env) {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}
export const callbackUrl = () =>
  applicationOrigin() + "/api/auth/google/callback";
export const googleProvider = {
  authorizationUrl({ state, nonce, challenge }) {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl(),
    );
    return client.generateAuthUrl({
      scope: ["openid", "email", "profile"],
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
      prompt: "select_account",
    });
  },
  async verify({ code, verifier, nonce }) {
    const client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl(),
    );
    const { tokens } = await client.getToken({ code, codeVerifier: verifier });
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    if (
      !profile?.sub ||
      profile.email_verified !== true ||
      typeof profile.email !== "string" ||
      profile.nonce !== nonce
    )
      throw new Error("Google account verification failed.");
    return {
      sub: profile.sub,
      email: profile.email.toLowerCase(),
      name: profile.name || "Google User",
    };
  },
};
