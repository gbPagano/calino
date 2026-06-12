/**
 * Validates RFC 4122 UUID format. Thin wrapper over `uuid.validate` from the
 * existing `uuid` dev dependency, which covers versions 1-7 and the standard
 * variant byte (8/9/a/b).
 */
import { validate as uuidValidate } from 'uuid'

export function isUUID(value: string): boolean {
  return uuidValidate(value)
}
