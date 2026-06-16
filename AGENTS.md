# Repository Guidelines

## Project Structure & Module Organization

Cookies Grandma is a Node.js/Express e-commerce site with static storefront pages and API routes. The root `server.js` exports the Express app and also runs local development. API route handlers live in `routes/`, shared helpers in `lib/`, middleware in `middleware/`, and service integrations in `services/`. The `api/index.js` entry point supports Vercel serverless deployment. Static pages and assets live in `public/`; editable frontend copies are in `frontend/`. Product media is stored in `Resources/` and `Resources_2/`. Database setup files are in `database/` plus `supabase-setup.sql`.

## Build, Test, and Development Commands

- `npm install`: install Express, PostgreSQL, auth, mail, and payment dependencies.
- `npm start`: run `node server.js` for production-like local execution.
- `npm run dev`: run the API with `nodemon` for automatic restarts.
- `npm run db:setup`: run the configured database setup script.
- `cd backend; npm run dev`: run the backend copy when working inside `backend/`.

There is no frontend build step; HTML and files under `public/` are served as static assets.

## Coding Style & Naming Conventions

Use CommonJS modules (`require`, `module.exports`) and 2-space indentation for JavaScript. Keep route files named by resource, such as `routes/orders.js`. Prefer camelCase for local variables and functions, and snake_case only when matching database columns or request payload fields. Keep SQL parameterized with `$1`, `$2`, etc.; never interpolate user input into SQL strings.

## Testing Guidelines

No test framework is currently configured. For changes, manually verify the affected endpoint or page and document the check in the pull request. Smoke checks include `GET /api/health`, `POST /api/orders`, and admin authentication flows. If adding tests, place them in `tests/` or beside the module as `*.test.js`, and add an `npm test` script.

## Commit & Pull Request Guidelines

Recent commits use short imperative subjects with optional prefixes, for example `Fix: enable SSL for Supabase PostgreSQL connection`. Follow that pattern: `Fix: ...`, `Debug: ...`, `Restructure: ...`, or a concise imperative sentence.

Pull requests should include a summary, affected routes or pages, environment changes, database migration notes, and screenshots for visible UI updates. Link related issues when available and list the commands or manual checks performed.

## Security & Configuration Tips

Copy `.env.example` to `.env` for local work and keep real secrets out of Git. Required configuration includes `DATABASE_URL` and `JWT_SECRET`; email and Midtrans keys are optional integrations. Treat `Resources/` files as customer-facing assets and avoid committing unnecessary originals or oversized experiments.
