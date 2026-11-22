# Email verification and Google sign-in

Public signups require a name, unique username, email and password. An account is only created after a valid email code is entered. It starts as Pending, with no linked students; an administrator assigns the school role and approves access in Users. Existing accounts keep email/password login and can receive a username in the account editor.

Codes expire after 10 minutes, allow five attempts, can be used once, and cannot be resent within 60 seconds. Password resets accept email or username and deliver to the account's registered email. Successful resets invalidate all prior sessions. No verification codes are returned by the API or printed in logs.

## Hostinger environment variables

Add these to the web app's Environment variables page. Keep all credentials in Hostinger, never in GitHub or browser code.

| Key                    | Value                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `APP_URL`              | `https://school-management.marketectify.com`                                                                      |
| `COOKIE_SECURE`        | `true` for the HTTPS deployment                                                                                   |
| `AUTH_CODE_SECRET`     | A new random secret of at least 32 characters; use a password manager to generate it                              |
| `SMTP_HOST`            | Hostname supplied by your email provider                                                                          |
| `SMTP_PORT`            | Provider's SMTP port, normally `465` or `587`                                                                     |
| `SMTP_USER`            | SMTP login username                                                                                               |
| `SMTP_PASS`            | SMTP password or provider app password                                                                            |
| `MAIL_FROM`            | An address your email provider permits you to send from, optionally `School Management <your-sender@your-domain>` |
| `GOOGLE_CLIENT_ID`     | Web OAuth client ID from Google Cloud                                                                             |
| `GOOGLE_CLIENT_SECRET` | Secret for that web OAuth client                                                                                  |

Port 465 uses implicit TLS; other ports require STARTTLS. The implementation keeps certificate validation enabled. See [Nodemailer SMTP configuration](https://nodemailer.com/smtp).

If mail settings or the code secret are missing, signup and reset fail closed and the screen explains that verification is unavailable. Google sign-in is visibly disabled until its client credentials exist. There is no development code bypass in production.

## Google Cloud setup

Create an OAuth client of type Web application, configure the consent screen, and register this exact authorized redirect URI:

```
https://school-management.marketectify.com/api/auth/google/callback
```

Use `http://localhost:4000/api/auth/google/callback` only for local development, with `APP_URL=http://localhost:4000`.

While the consent screen is in Testing, add the intended demo Google accounts as test users. Publish the consent configuration as appropriate for the intended audience. See [Google web server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server).

The app requests only identity, email and profile scopes. OAuth state, PKCE, a nonce and Google's server-side ID token verification are used. Tokens are not trusted from browser-provided names or emails. New Google signups and first-time linking to an existing local account also require a code delivered to the email address. Subsequent sign-ins use the stored Google subject. Changing an account's email in Users removes its old Google link. See [Google backend token verification](https://developers.google.com/identity/sign-in/web/backend-auth).

## Validate after deployment

1. Deploy the merged branch with the environment variables above.
2. Sign up using an email you control. Confirm the real email arrives and no user exists before entering the code.
3. Verify the email; confirm the account appears as Pending in Users. Assign the correct school role and linked students, then activate it.
4. Sign in using the username, then email. Test an incorrect/expired/reused code.
5. Reset the password using a registered identifier. Check that the old password and an older browser session stop working.
6. Test Google sign-in with an authorized Google test user. Check first-time email verification, pending approval, and subsequent Google login.

Automated tests use injected mail and Google providers. SMTP delivery and real Google authorization must be verified with your configured accounts after deployment; no test email is sent to real users by the test suite.
