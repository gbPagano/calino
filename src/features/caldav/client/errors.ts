/**
 * Connection failure carrying the probe's provider-specific guidance, so the
 * UI can render the hint alongside the message without re-deriving it.
 *
 * Lives apart from the hook that throws it: consumers that mock `useCalDAV`
 * still need the real class for `instanceof` to work.
 */
export class CalDAVConnectionError extends Error {
  constructor(
    message: string,
    public readonly hint?: string
  ) {
    super(message)
    this.name = 'CalDAVConnectionError'
  }
}
