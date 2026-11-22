import React, { useEffect, useState } from "react";
import { Icon } from "./icons.jsx";
import { api } from "./api.js";
import "./authentication.css";

const flowKey = "school-verification-flow";
export function AccountSecurity({ user, finish, updated }) {
  const [username, setUsername] = useState(user.username || ""),
    [flow, setFlow] = useState(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const waiting = flow
    ? Math.max(0, Math.ceil((flow.resendAt - now) / 1000))
    : 0;
  function issued(r) {
    setFlow({ token: r.token, resendAt: Date.now() + r.resendAfter * 1000 });
    setNotice(r.message);
  }
  async function saveName(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const account = await api("auth/username", "PUT", { username });
      updated?.(account);
      setNotice(
        "Username saved. You can sign in with this username or your email.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function start() {
    setBusy(true);
    setError("");
    try {
      issued(await api("auth/reset/start", "POST", { identifier: user.email }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      issued(await api("auth/code/resend", "POST", { token: flow.token }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function changePassword(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const value = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (value.password !== value.confirm)
        throw Error("Passwords do not match.");
      await api("auth/reset/complete", "POST", {
        token: flow.token,
        code: value.code,
        password: value.password,
      });
      history.replaceState(null, "", "/?auth_notice=password_changed");
      await finish();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-account-security">
      <h2>
        <Icon name="shieldCheck" />
        Account Security
      </h2>
      {error && (
        <p className="auth-alert" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="auth-notice" role="status">
          {notice}
        </p>
      )}
      <form onSubmit={saveName}>
        <Field
          label="Your username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a unique username"
          required
          minLength={3}
          maxLength={30}
        />
        <button className="primary" disabled={busy}>
          Save Username
        </button>
      </form>
      <div className="auth-account-reset">
        <h3>Change password</h3>
        <p>
          A verification code will be sent to <strong>{user.email}</strong>.
          Your other sessions will end after the password changes.
        </p>
        {!flow ? (
          <button type="button" onClick={start} disabled={busy}>
            Send Password Change Code
          </button>
        ) : (
          <form onSubmit={changePassword}>
            <Field
              label="Email verification code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              maxLength={6}
              pattern="[0-9]{6}"
              required
            />
            <Field
              label="New password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <Field
              label="Confirm new password"
              name="confirm"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
            <div className="actions">
              <button className="primary" disabled={busy}>
                Change Password
              </button>
              <button
                type="button"
                disabled={busy || waiting > 0}
                onClick={resend}
              >
                {waiting ? "Resend in " + waiting + "s" : "Resend Code"}
              </button>
              <button
                type="button"
                onClick={() => setFlow(null)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
const urlState = () => {
  const p = new URLSearchParams(location.search),
    token = p.get("auth_flow"),
    kind = p.get("auth_kind");
  if (
    token &&
    /^[a-f0-9]{64}$/.test(token) &&
    ["google-signup", "google-link"].includes(kind)
  )
    return {
      type: kind,
      token,
      expiresAt: Date.now() + 600000,
      resendAt: Date.now() + 60000,
    };
  try {
    const stored = JSON.parse(sessionStorage.getItem(flowKey));
    if (stored?.expiresAt > Date.now() && /^[a-f0-9]{64}$/.test(stored.token))
      return stored;
  } catch {}
  return null;
};
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.08v2.59A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.42 13.92a6 6 0 0 1 0-3.84V7.49H3.08a10 10 0 0 0 0 9.02l3.34-2.59Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.96c1.47 0 2.79.5 3.82 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.92 5.49l3.34 2.59A5.97 5.97 0 0 1 12 5.96Z"
      />
    </svg>
  );
}
function Field({ label, name, type = "text", icon = "profile", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <label className="auth-label">
      {label}
      <span className="auth-field">
        <Icon name={icon} />
        <input
          name={name}
          type={type === "password" && show ? "text" : type}
          {...props}
        />
        {type === "password" && (
          <button
            type="button"
            aria-label={show ? "Hide password" : "Show password"}
            onClick={() => setShow((v) => !v)}
          >
            <Icon name={show ? "eyeOff" : "eye"} />
          </button>
        )}
      </span>
    </label>
  );
}
export default function Authentication({ onLogin }) {
  const [flow, setFlow] = useState(urlState),
    [mode, setMode] = useState(() =>
      urlState()
        ? "verify"
        : new URLSearchParams(location.search).get("auth_action") === "reset"
          ? "forgot"
          : "login",
    ),
    [config, setConfig] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [now, setNow] = useState(Date.now()),
    [draft, setDraft] = useState({});
  useEffect(() => {
    api("auth/config").then(setConfig, () =>
      setConfig({ email: false, google: false }),
    );
    const query = new URLSearchParams(location.search);
    const e = query.get("auth_error"),
      n = query.get("auth_notice");
    if (e)
      setError(
        e === "google_unavailable"
          ? "Google sign-in is not available yet. Please use your email or username."
          : "Google sign-in could not complete. Please try again.",
      );
    if (n)
      setNotice(
        n === "pending"
          ? "Your account is awaiting administrator approval."
          : n === "password_changed"
            ? "Password changed. Sign in again with your new password."
            : "This account is not active. Contact your administrator.",
      );
    if (
      [
        "auth_flow",
        "auth_kind",
        "auth_error",
        "auth_notice",
        "auth_action",
      ].some((k) => query.has(k))
    ) {
      for (const k of [
        "auth_flow",
        "auth_kind",
        "auth_error",
        "auth_notice",
        "auth_action",
      ])
        query.delete(k);
      history.replaceState(
        null,
        "",
        location.pathname + (query.size ? "?" + query.toString() : ""),
      );
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (flow) sessionStorage.setItem(flowKey, JSON.stringify(flow));
    else sessionStorage.removeItem(flowKey);
  }, [flow]);
  function change(next) {
    setMode(next);
    setFlow(null);
    setError("");
    setNotice("");
  }
  function startFlow(result, type, email) {
    setFlow({
      type,
      token: result.token,
      email,
      expiresAt: Date.now() + result.expiresIn * 1000,
      resendAt: Date.now() + result.resendAfter * 1000,
    });
    setMode("verify");
    setNotice(result.message);
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const values = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (mode === "login") {
        onLogin(await api("auth/login", "POST", values));
        return;
      }
      if (mode === "signup") {
        if (values.password !== values.confirm)
          throw Error("Passwords do not match.");
        setDraft({
          name: values.name,
          email: values.email,
          username: values.username,
        });
        const result = await api("auth/signup/start", "POST", {
          name: values.name,
          email: values.email,
          username: values.username,
          password: values.password,
        });
        startFlow(result, "signup", values.email);
        return;
      }
      if (mode === "forgot") {
        startFlow(
          await api("auth/reset/start", "POST", {
            identifier: values.identifier,
          }),
          "reset",
        );
        return;
      }
      if (mode === "verify") {
        if (flow.type === "reset" && values.password !== values.confirm)
          throw Error("Passwords do not match.");
        const endpoint =
          flow.type === "signup"
            ? "signup/verify"
            : flow.type === "reset"
              ? "reset/complete"
              : "google/verify";
        const result = await api("auth/" + endpoint, "POST", {
          token: flow.token,
          code: values.code,
          ...(flow.type === "reset" ? { password: values.password } : {}),
          ...(flow.type === "google-signup"
            ? { username: values.username }
            : {}),
        });
        setFlow(null);
        if (result.user) {
          onLogin(result.user);
          return;
        }
        setNotice(result.message);
        setMode(result.pending ? "pending" : "login");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    try {
      const r = await api("auth/code/resend", "POST", { token: flow.token });
      setFlow((f) => ({
        ...f,
        token: r.token,
        expiresAt: Date.now() + r.expiresIn * 1000,
        resendAt: Date.now() + r.resendAfter * 1000,
      }));
      setNotice(r.message);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const remaining = flow
      ? Math.max(0, Math.ceil((flow.resendAt - now) / 1000))
      : 0,
    expired = flow && flow.expiresAt <= now;
  const title =
    mode === "login"
      ? "Welcome back"
      : mode === "signup"
        ? "Create your account"
        : mode === "forgot"
          ? "Forgot your password?"
          : mode === "pending"
            ? "Email verified"
            : flow?.type === "reset"
              ? "Set a new password"
              : "Check your email";
  const subtitle =
    mode === "login"
      ? "Sign in to your school workspace."
      : mode === "signup"
        ? "Get started with your name, username and email."
        : mode === "forgot"
          ? "We’ll send a verification code to your registered email."
          : mode === "pending"
            ? "Your account is ready for administrator review."
            : flow?.email
              ? "Enter the six-digit code sent to " + flow.email + "."
              : "Enter the six-digit code sent to your registered email.";
  return (
    <main className="auth-page">
      <div className="auth-top">
        <a href="/" className="auth-brand">
          <span>
            <Icon name="cap" />
          </span>
          <div>
            School Management<small>by Marketectify</small>
          </div>
        </a>
        <span className="auth-secure">
          <Icon name="shieldCheck" />
          Secure school access
        </span>
      </div>
      <section className="auth-shell">
        <div className="auth-form-panel">
          {["login", "signup"].includes(mode) && (
            <div className="auth-tabs" role="group" aria-label="Account access">
              <button
                type="button"
                aria-pressed={mode === "login"}
                onClick={() => change("login")}
              >
                Log in
              </button>
              <button
                type="button"
                aria-pressed={mode === "signup"}
                onClick={() => change("signup")}
              >
                Sign up
              </button>
            </div>
          )}
          {!["login", "signup"].includes(mode) && (
            <button
              className="auth-back"
              type="button"
              onClick={() => change("login")}
            >
              <Icon name="back" />
              Back to log in
            </button>
          )}
          <div
            className={"auth-heading" + (mode === "pending" ? " centered" : "")}
          >
            {["verify", "forgot", "pending"].includes(mode) && (
              <span
                className={
                  "auth-step-icon " + (mode === "pending" ? "done" : "")
                }
              >
                <Icon
                  name={
                    mode === "pending"
                      ? "circleCheck"
                      : mode === "forgot"
                        ? "lock"
                        : "mail"
                  }
                />
              </span>
            )}
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          {error && (
            <div className="auth-alert" role="alert">
              <Icon name="alert" />
              {error}
            </div>
          )}
          {notice && (
            <div className="auth-notice" role="status">
              <Icon name="circleCheck" />
              {notice}
            </div>
          )}
          {mode === "pending" ? (
            <div className="auth-pending">
              <div>
                <Icon name="check" />
                <span>Email ownership confirmed</span>
              </div>
              <div>
                <Icon name="time" />
                <span>Administrator assigns your school role</span>
              </div>
              <div>
                <Icon name="lock" />
                <span>Sign in once access is approved</span>
              </div>
              <button className="auth-submit" onClick={() => change("login")}>
                Return to Log In
                <Icon name="forward" />
              </button>
            </div>
          ) : (
            <form key={mode} onSubmit={submit}>
              {mode === "login" && (
                <>
                  <Field
                    label="Email or username"
                    name="identifier"
                    icon="profile"
                    autoComplete="username"
                    placeholder="you@example.com or username"
                    required
                    maxLength={254}
                  />
                  <div className="auth-password-label">
                    <span>Password</span>
                    <button type="button" onClick={() => change("forgot")}>
                      Forgot password?
                    </button>
                  </div>
                  <Field
                    label={<span className="auth-sr">Password</span>}
                    name="password"
                    icon="lock"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    required
                    maxLength={128}
                  />
                </>
              )}
              {mode === "signup" && (
                <>
                  <Field
                    label="Full name"
                    name="name"
                    autoComplete="name"
                    placeholder="Your full name"
                    defaultValue={draft.name || ""}
                    required
                    maxLength={120}
                  />
                  <Field
                    label="Username"
                    name="username"
                    icon="badge"
                    autoComplete="username"
                    placeholder="Choose a unique username"
                    defaultValue={draft.username || ""}
                    required
                    minLength={3}
                    maxLength={30}
                    pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,29}"
                  />
                  <Field
                    label="Email address"
                    name="email"
                    icon="mail"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    defaultValue={draft.email || ""}
                    required
                    maxLength={254}
                  />
                  <div className="auth-two-fields">
                    <Field
                      label="Password"
                      name="password"
                      icon="lock"
                      type="password"
                      autoComplete="new-password"
                      placeholder="At least 12 characters"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                    <Field
                      label="Confirm password"
                      name="confirm"
                      icon="lock"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Repeat password"
                      minLength={12}
                      maxLength={128}
                      required
                    />
                  </div>
                  <p className="auth-form-note">
                    <Icon name="shieldCheck" />
                    Your email must be verified before an account can be
                    created.
                  </p>
                </>
              )}
              {mode === "forgot" && (
                <Field
                  label="Email or username"
                  name="identifier"
                  icon="profile"
                  autoComplete="username"
                  placeholder="Your registered email or username"
                  required
                  maxLength={254}
                />
              )}
              {mode === "verify" && (
                <>
                  {flow?.type === "google-signup" && (
                    <Field
                      label="Choose a username"
                      name="username"
                      icon="badge"
                      autoComplete="username"
                      placeholder="Your unique username"
                      minLength={3}
                      maxLength={30}
                      required
                      pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]{2,29}"
                    />
                  )}
                  <label className="auth-label">
                    Verification code
                    <input
                      className="auth-code"
                      name="code"
                      aria-label="Verification code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      placeholder="000000"
                      minLength={6}
                      maxLength={6}
                      required
                    />
                  </label>
                  {flow?.type === "reset" && (
                    <>
                      <Field
                        label="New password"
                        name="password"
                        type="password"
                        icon="lock"
                        autoComplete="new-password"
                        placeholder="At least 12 characters"
                        minLength={12}
                        maxLength={128}
                        required
                      />
                      <Field
                        label="Confirm new password"
                        name="confirm"
                        type="password"
                        icon="lock"
                        autoComplete="new-password"
                        placeholder="Repeat your new password"
                        minLength={12}
                        maxLength={128}
                        required
                      />
                    </>
                  )}
                  <p className={"auth-expiry" + (expired ? " expired" : "")}>
                    {expired
                      ? "Your code has expired. Request a new one."
                      : "Code expires in " +
                        Math.floor(
                          Math.max(0, (flow.expiresAt - now) / 1000) / 60,
                        ) +
                        ":" +
                        String(
                          Math.floor(
                            Math.max(0, (flow.expiresAt - now) / 1000) % 60,
                          ),
                        ).padStart(2, "0")}
                  </p>
                </>
              )}
              {["signup", "forgot"].includes(mode) &&
                config &&
                !config.email && (
                  <p className="auth-alert" role="status">
                    Email verification is temporarily unavailable. Please
                    contact your administrator.
                  </p>
                )}
              <button
                className="auth-submit"
                type="submit"
                disabled={
                  busy ||
                  (["signup", "forgot"].includes(mode) &&
                    (!config || !config.email)) ||
                  (mode === "verify" && expired)
                }
              >
                {busy
                  ? "Please wait…"
                  : mode === "login"
                    ? "Log In"
                    : mode === "signup"
                      ? "Send Verification Code"
                      : mode === "forgot"
                        ? "Send Reset Code"
                        : flow?.type === "reset"
                          ? "Change Password"
                          : "Verify Email"}
                <Icon name={busy ? "refresh" : "forward"} />
              </button>
              {mode === "verify" && (
                <div className="auth-resend">
                  <span>Didn’t receive the code?</span>
                  <button
                    type="button"
                    disabled={busy || remaining > 0}
                    onClick={resend}
                  >
                    {remaining > 0
                      ? "Resend in " + remaining + "s"
                      : "Resend Code"}
                  </button>
                  {flow?.type === "signup" && (
                    <button type="button" onClick={() => change("signup")}>
                      Change email
                    </button>
                  )}
                </div>
              )}
            </form>
          )}
          {["login", "signup"].includes(mode) && (
            <>
              <div className="auth-divider">
                <span>or continue with</span>
              </div>
              <button
                className="auth-google"
                type="button"
                disabled={!config?.google || busy}
                onClick={() => {
                  sessionStorage.removeItem(flowKey);
                  location.assign("/api/auth/google/start");
                }}
              >
                <GoogleMark />
                Continue with Google
              </button>
              {config && !config.google && (
                <p className="auth-google-note">
                  Google sign-in is being set up. Please use email for now.
                </p>
              )}
              <p className="auth-switch">
                {mode === "login"
                  ? "New to this workspace?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => change(mode === "login" ? "signup" : "login")}
                >
                  {mode === "login" ? "Create an account" : "Log in"}
                </button>
              </p>
            </>
          )}
          <p className="auth-footer">
            <Icon name="lock" />
            Your account. Your school. Connected securely.
          </p>
        </div>
        <div className="auth-story">
          <div className="auth-orbit o1" />
          <div className="auth-orbit o2" />
          <span className="auth-eyebrow">
            <span />
            ONE CONNECTED WORKSPACE
          </span>
          <h2>
            Your school.
            <br />
            Together,
            <br />
            <em>every day.</em>
          </h2>
          <p>
            Learning, people and progress—
            <br />
            all in one place.
          </p>
          <div className="auth-story-cards">
            <article>
              <span>
                <Icon name="cap" />
              </span>
              <div>
                <strong>A place for everyone</strong>
                <small>Admins · Teachers · Students · Parents</small>
              </div>
              <Icon name="tick" />
            </article>
            <article>
              <span>
                <Icon name="shieldCheck" />
              </span>
              <div>
                <strong>Access you can trust</strong>
                <small>Verified email. The right permissions.</small>
              </div>
              <Icon name="tick" />
            </article>
          </div>
          <div className="auth-story-footer">
            <div>
              <Icon name="calendar" />
              <Icon name="book" />
              <Icon name="users" />
              <Icon name="chartLine" />
            </div>
            <span>Built for your school community</span>
          </div>
        </div>
      </section>
      <p className="auth-copyright">
        © {new Date().getFullYear()} Marketectify · School Management
      </p>
    </main>
  );
}
