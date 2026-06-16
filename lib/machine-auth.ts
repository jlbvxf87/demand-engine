export function isMachineAuthed(req: Request): boolean {
  const key = process.env.MACHINE_API_KEY;
  if (!key) return false;
  const header =
    req.headers.get('x-api-key') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return header === key;
}
