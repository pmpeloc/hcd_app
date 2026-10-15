/**
 * Demo data fallback: `true` only when the build opts in explicitly. Set in
 * Playwright's webServer env so signed-in e2e sessions (synthetic auth, no
 * backend) can exercise the screens; never set in production, where real
 * users with a session must always hit the API.
 */
export const DEMO_DATA = process.env.NEXT_PUBLIC_DEMO_RECORDS === '1';
