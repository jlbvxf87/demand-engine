import { cookies } from 'next/headers';

const COOKIE_NAME = 'demand_engine_admin';

/** Returns true if the request is authenticated via cookie or query key. */
export async function isAdminAuthed(searchParamsKey?: string): Promise<boolean> {
  const internal = process.env.INTERNAL_API_SECRET;
  const adminPw = process.env.ADMIN_PASSWORD;
  const validTokens = [internal, adminPw].filter((v): v is string => Boolean(v));
  if (validTokens.length === 0) return false;

  // Check cookie first.
  const c = await cookies();
  const cookieValue = c.get(COOKIE_NAME)?.value?.replace(/\s+/g, '');
  if (cookieValue && validTokens.some((t) => t.replace(/\s+/g, '') === cookieValue)) {
    return true;
  }

  // Fallback: query/form key (back-compat with older URLs and POST forms).
  const submitted = (searchParamsKey ?? '').replace(/\s+/g, '');
  if (submitted && validTokens.some((t) => t.replace(/\s+/g, '') === submitted)) {
    return true;
  }

  return false;
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
