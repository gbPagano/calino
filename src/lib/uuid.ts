/**
 * Validates RFC 4122 UUID format including version (1-5) and variant (8/9/a/b).
 * Accepts: 550e8400-e29b-41d4-a716-446655440000
 * Rejects: 00000000-0000-0000-0000-000000000000
 */
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUUID(value: string): boolean {
  return uuidRegex.test(value)
}
