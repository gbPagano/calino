/**
 * Connection failure carrying the probe's provider-specific guidance, so the
 * UI can render the hint alongside the message without re-deriving it.
 *
 * Lives apart from the hook that throws it: consumers that mock `useCalDAV`
 * still need the real class for `instanceof` to work.
 *
 * The `hint` field is declared explicitly rather than as a parameter property
 * (`constructor(..., public readonly hint?: string)`) because the project's
 * tsconfig sets `erasableSyntaxOnly`, which bans parameter-property syntax
 * (TS1294). The runtime shape is unchanged.
 */
export class CalDAVConnectionError extends Error {
  readonly hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'CalDAVConnectionError'
    this.hint = hint
  }
}
