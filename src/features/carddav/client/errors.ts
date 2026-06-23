export class CardDAVConflictError extends Error {
  currentEtag: string
  serverData?: string
  constructor(currentEtag: string, serverData?: string) {
    super('Contact was modified server-side. Please refresh and try again.')
    this.name = 'CardDAVConflictError'
    this.currentEtag = currentEtag
    this.serverData = serverData
  }
}

export class CardDAVPermissionError extends Error {
  constructor() {
    super('You do not have permission to modify this contact.')
    this.name = 'CardDAVPermissionError'
  }
}

export class CardDAVSizeLimitError extends Error {
  maxSize: number
  actualSize: number
  constructor(maxSize: number, actualSize: number) {
    super(`Contact exceeds the server's size limit (${maxSize} bytes).`)
    this.name = 'CardDAVSizeLimitError'
    this.maxSize = maxSize
    this.actualSize = actualSize
  }
}

export class CardDAVVersionError extends Error {
  supportedVersions: ('3.0' | '4.0')[]
  constructor(supportedVersions: ('3.0' | '4.0')[]) {
    super(`Server does not accept any vCard version this client can produce.`)
    this.name = 'CardDAVVersionError'
    this.supportedVersions = supportedVersions
  }
}
