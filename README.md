# School Management

A MERN school administration application with React, Express and MongoDB. The interface takes its navigation and student directory cues from the Preskool demo.

## Run locally

1. Install Node.js 22.12 or later. Start your MongoDB instance, or run `docker compose up -d`.
2. Run `npm ci`.
3. On Windows, run `Copy-Item .env.example .env`. On macOS or Linux, run `cp .env.example .env`.
4. Set `SEED_ADMIN_EMAIL` and a private `SEED_ADMIN_PASSWORD` of at least 12 characters in `.env`. Set `MONGODB_URI` if your database uses a different address.
5. Run `npm run seed` to create the first administrator, then `npm run dev`. Open the URL Vite prints, normally `http://localhost:5173`.
6. Sign in, add a class, add a student and assign them to the class. Use User accounts to create role-specific logins. Student and parent accounts must be linked to student records.

For a local production build, run `npm run build` and `npm start`. Express serves the built app and the API from the same origin on port 4000 by default. Use HTTPS and `COOKIE_SECURE=true` for deployments.

## Authentication

The React app calls `GET /api/auth/me` on load to restore the current session. Login posts the email and password to `POST /api/auth/login`. Express rate-limits attempts, normalizes the email, and verifies the password against a per-user salted scrypt hash. Password hashes are excluded from ordinary account queries. The seed script and administrator account creation use the same hashing function.

On success, the server creates a 32-byte random opaque token. The browser receives it in an HttpOnly, SameSite=Strict cookie, and MongoDB stores its SHA-256 digest and expiration timestamp. Sessions expire after eight hours. Protected routes hash the cookie value, check for an unexpired session and load the current account. Logout deletes the corresponding session and clears the cookie. The browser keeps the signed-in user summary in React state and relies on the cookie for credentials.

Administrators manage records and create accounts. Teachers can manage homework, attendance and results and read academic records across the school. Students and parents have read-only views scoped to their linked students and classes. This version has one school.

## Implemented modules

- Role-specific dashboard counts and module navigation.
- Student, teacher and staff directories, plus admission applications.
- Classes and sections, subjects, timetable, homework, attendance, exams and marks.
- Student fee assignments and manually entered payment records.
- Library catalog, transport routes, hostel room directory and announcements.
- Record search, status filters, sorting, student card/table layouts and CSV exports.

The current release covers these workflows. Preskool's full ERP scope additionally includes advanced admissions and promotion, payroll, report cards, library lending, hostel and transport assignments, finance reconciliation, online payments, messaging, live tracking, AI, multi-school, and additional campus and administration modules.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /api/health | Database connection status |
| POST | /api/auth/login | Start a session |
| GET | /api/auth/me | Get the signed-in account summary |
| POST | /api/auth/logout | End the current session |
| GET | /api/dashboard | Counts within the current account's access |
| GET, POST | /api/users | List or create accounts as administrator |
| GET, POST | /api/records/:collection | List or create module records |
| PUT, DELETE | /api/records/:collection/:id | Update or delete a record |

The shared module definitions in `catalog.js` drive the React forms and Mongoose schemas. Server-side access controls and validation are in `server/index.js`.

## Demo data

Run `npm run seed:demo` against the configured demo database to add 12 fictional students and linked records across all school modules. This command uses the existing `MONGODB_URI` and is separate from administrator setup. Run it again to restore missing demo records. Existing records are preserved.

## Workspace screens

Calendar events, To Do items and Notes are private to the signed-in account. The demo seed adds an example of each for the administrator identified by SEED_ADMIN_EMAIL. The admin dashboard uses saved attendance, enrollment, fees and exam marks. Student profiles include overview, attendance, results and fees.

## Top bar and role dashboards

The top bar provides record search, academic-year selection, country formatting for notifications, Quick Add, layout choices, notifications, internal messages, app shortcuts and account details. Admins can add schools and switch between their record sets. Existing records belong to the primary campus. School accounts and messaging remain shared, and teacher, student and parent sign-ins currently use the primary campus.

Admin accounts can preview each dashboard layout with school data. Actual student and parent sessions remain limited to their linked student records. Email opens the internal inbox, Call opens the contact directory, and Files stores document links. This release uses neither external mail delivery nor video calling or file uploads.
