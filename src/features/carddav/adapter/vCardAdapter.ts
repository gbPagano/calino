import type {
  Contact,
  ContactEmail,
  ContactPhone,
  ContactAddress,
  ContactUrl,
  ContactIM,
} from '../types'

/**
 * Parse a vCard string into a Contact object.
 * Supports vCard 3.0 and 4.0.
 */
export function parseVCard(vCardString: string, addressBookId: string, accountId: string): Contact | null {
  const lines = unfoldVCard(vCardString)
  
  // Extract basic properties
  const fn = extractProperty(lines, 'FN') || ''
  const n = extractProperty(lines, 'N') || ''
  const nParts = n.split(';')
  
  const uid = extractProperty(lines, 'UID') || crypto.randomUUID()
  const url = extractProperty(lines, 'URL') || ''
  
  // Parse structured name
  const familyName = nParts[0] || ''
  const givenName = nParts[1] || ''
  const additionalNames = nParts[2] || ''
  const prefixes = nParts[3] || ''
  const suffixes = nParts[4] || ''
  
  // Parse organization
  const org = extractProperty(lines, 'ORG') || ''
  const orgParts = org.split(';')
  const organization = orgParts[0] || ''
  const department = orgParts[1] || ''
  
  // Parse title and role
  const title = extractProperty(lines, 'TITLE') || ''
  const role = extractProperty(lines, 'ROLE') || ''
  
  // Parse emails
  const emails = extractEmails(lines)
  
  // Parse phones
  const phones = extractPhones(lines)
  
  // Parse addresses
  const addresses = extractAddresses(lines)
  
  // Parse URLs
  const urls = extractUrls(lines)
  
  // Parse IMs
  const ims = extractIMs(lines)
  
  // Parse dates
  const birthday = parseVCardDate(extractProperty(lines, 'BDAY'))
  const anniversary = parseVCardDate(extractProperty(lines, 'ANNIVERSARY'))
  
  // Parse gender
  const gender = extractProperty(lines, 'GENDER') || ''
  
  // Parse note
  const note = extractProperty(lines, 'NOTE') || ''
  
  // Parse categories
  const categoriesStr = extractProperty(lines, 'CATEGORIES') || ''
  const categories = categoriesStr.split(',').map(c => c.trim()).filter(Boolean)
  
  // Parse photo
  const photo = extractPhoto(lines)
  
  // Parse timestamps
  const created = extractProperty(lines, 'CREATED') || new Date().toISOString()
  const lastModified = extractProperty(lines, 'REV') || new Date().toISOString()
  
  // Generate display name if not provided
  const displayName = fn || `${givenName} ${familyName}`.trim() || 'Unknown'
  
  return {
    id: uid,
    addressBookId,
    accountId,
    url,
    familyName,
    givenName,
    additionalNames,
    prefixes,
    suffixes,
    displayName,
    organization,
    department,
    title,
    role,
    emails,
    phones,
    addresses,
    urls,
    ims,
    birthday,
    anniversary,
    gender,
    note,
    categories,
    photo,
    rawVCard: vCardString,
    createdAt: created,
    lastModified,
  }
}

/**
 * Serialize a Contact object into a vCard string.
 */
export function contactToVCard(contact: Contact): string {
  const lines: string[] = []
  
  lines.push('BEGIN:VCARD')
  lines.push('VERSION:4.0')
  
  // UID
  lines.push(`UID:${contact.id}`)
  
  // Structured name
  const n = [
    contact.familyName,
    contact.givenName,
    contact.additionalNames,
    contact.prefixes,
    contact.suffixes,
  ].join(';')
  lines.push(`N:${n}`)
  
  // Display name
  if (contact.displayName) {
    lines.push(`FN:${contact.displayName}`)
  }
  
  // Organization
  if (contact.organization || contact.department) {
    lines.push(`ORG:${contact.organization};${contact.department}`)
  }
  
  // Title and role
  if (contact.title) {
    lines.push(`TITLE:${contact.title}`)
  }
  if (contact.role) {
    lines.push(`ROLE:${contact.role}`)
  }
  
  // Emails
  for (const email of contact.emails) {
    const params = buildTypeParams(email.type, email.isPrimary)
    lines.push(`EMAIL${params}:${email.value}`)
  }
  
  // Phones
  for (const phone of contact.phones) {
    const params = buildTypeParams(phone.type, phone.isPrimary)
    lines.push(`TEL${params}:${phone.value}`)
  }
  
  // Addresses
  for (const addr of contact.addresses) {
    const params = buildTypeParams(addr.type, addr.isPrimary)
    const value = [
      addr.poBox,
      addr.extended,
      addr.street,
      addr.city,
      addr.region,
      addr.postalCode,
      addr.country,
    ].join(';')
    lines.push(`ADR${params}:${value}`)
  }
  
  // URLs
  for (const url of contact.urls) {
    const params = buildTypeParams(url.type, url.isPrimary)
    lines.push(`URL${params}:${url.value}`)
  }
  
  // IMs
  for (const im of contact.ims) {
    const params = buildIMParams(im.type, im.protocol, im.isPrimary)
    lines.push(`IMPP${params}:${im.value}`)
  }
  
  // Birthday
  if (contact.birthday) {
    const bday = formatVCardDate(contact.birthday)
    if (bday) {
      lines.push(`BDAY:${bday}`)
    }
  }
  
  // Anniversary
  if (contact.anniversary) {
    const ann = formatVCardDate(contact.anniversary)
    if (ann) {
      lines.push(`ANNIVERSARY:${ann}`)
    }
  }
  
  // Gender
  if (contact.gender) {
    lines.push(`GENDER:${contact.gender}`)
  }
  
  // Note
  if (contact.note) {
    lines.push(`NOTE:${escapeVCardValue(contact.note)}`)
  }
  
  // Categories
  if (contact.categories.length > 0) {
    lines.push(`CATEGORIES:${contact.categories.join(',')}`)
  }
  
  // Photo
  if (contact.photo) {
    if (contact.photo.startsWith('data:')) {
      // Inline base64 photo
      const base64 = contact.photo.split(',')[1]
      if (base64) {
        lines.push('PHOTO;ENCODING=b;TYPE=JPEG:' + base64)
      }
    } else if (contact.photo.startsWith('http')) {
      // URI photo
      lines.push(`PHOTO;VALUE=URI:${contact.photo}`)
    }
  }
  
  // Timestamps
  lines.push(`CREATED:${contact.createdAt}`)
  lines.push(`REV:${contact.lastModified}`)
  
  lines.push('END:VCARD')
  
  return lines.join('\r\n')
}

// Helper functions

function unfoldVCard(vCard: string): string[] {
  // Unfold continuation lines (lines starting with space or tab)
  const unfolded = vCard.replace(/\r?\n[ \t]/g, '')
  return unfolded.split(/\r?\n/)
}

function extractProperty(lines: string[], property: string): string | null {
  const prefix = property + ':'
  const prefixUpper = prefix.toUpperCase()
  
  for (const line of lines) {
    const lineUpper = line.toUpperCase()
    if (lineUpper.startsWith(prefixUpper)) {
      return line.substring(prefix.length)
    }
  }
  return null
}

/**
 * Parse a single vCard line with property params.
 * e.g. 'EMAIL;TYPE=HOME:john@example.com' → { params: 'TYPE=HOME', value: 'john@example.com' }
 */
function parseLineWithParams(line: string, property: string): { value: string; params: string } | null {
  const lineUpper = line.toUpperCase()
  const prefixWithSemicolon = (property + ';').toUpperCase()
  const prefixWithColon = (property + ':').toUpperCase()
  
  if (lineUpper.startsWith(prefixWithSemicolon)) {
    const rest = line.substring(property.length + 1)
    const colonIndex = rest.indexOf(':')
    if (colonIndex >= 0) {
      return {
        params: rest.substring(0, colonIndex),
        value: rest.substring(colonIndex + 1),
      }
    }
  } else if (lineUpper.startsWith(prefixWithColon)) {
    return {
      params: '',
      value: line.substring(property.length + 1),
    }
  }
  return null
}

function extractPropertyWithParams(lines: string[], property: string): { value: string; params: string } | null {
  for (const line of lines) {
    const result = parseLineWithParams(line, property)
    if (result) return result
  }
  return null
}

function extractEmails(lines: string[]): ContactEmail[] {
  const emails: ContactEmail[] = []
  
  for (const line of lines) {
    if (!line.toUpperCase().startsWith('EMAIL')) continue
    
    const result = parseLineWithParams(line, 'EMAIL')
    if (!result) continue
    
    const type = parseTypeParam(result.params)
    const isPrimary = result.params.toUpperCase().includes('PREF') || result.params.includes('TYPE=pref')
    
    emails.push({
      value: result.value,
      type,
      isPrimary,
    })
  }
  
  // Mark first as primary if none marked
  if (emails.length > 0 && !emails.some(e => e.isPrimary)) {
    emails[0].isPrimary = true
  }
  
  return emails
}

function extractPhones(lines: string[]): ContactPhone[] {
  const phones: ContactPhone[] = []
  
  for (const line of lines) {
    if (!line.toUpperCase().startsWith('TEL')) continue
    
    const result = parseLineWithParams(line, 'TEL')
    if (!result) continue
    
    const type = parsePhoneTypeParam(result.params)
    const isPrimary = result.params.toUpperCase().includes('PREF') || result.params.includes('TYPE=pref')
    
    phones.push({
      value: result.value,
      type,
      isPrimary,
    })
  }
  
  // Mark first as primary if none marked
  if (phones.length > 0 && !phones.some(p => p.isPrimary)) {
    phones[0].isPrimary = true
  }
  
  return phones
}

function extractAddresses(lines: string[]): ContactAddress[] {
  const addresses: ContactAddress[] = []
  
  for (const line of lines) {
    if (!line.toUpperCase().startsWith('ADR')) continue
    
    const result = parseLineWithParams(line, 'ADR')
    if (!result) continue
    
    const type = parseTypeParam(result.params)
    const isPrimary = result.params.toUpperCase().includes('PREF') || result.params.includes('TYPE=pref')
    
    const parts = result.value.split(';')
    
    addresses.push({
      type,
      isPrimary,
      poBox: parts[0] || '',
      extended: parts[1] || '',
      street: parts[2] || '',
      city: parts[3] || '',
      region: parts[4] || '',
      postalCode: parts[5] || '',
      country: parts[6] || '',
    })
  }
  
  // Mark first as primary if none marked
  if (addresses.length > 0 && !addresses.some(a => a.isPrimary)) {
    addresses[0].isPrimary = true
  }
  
  return addresses
}

function extractUrls(lines: string[]): ContactUrl[] {
  const urls: ContactUrl[] = []
  
  for (const line of lines) {
    if (!line.toUpperCase().startsWith('URL')) continue
    
    const result = parseLineWithParams(line, 'URL')
    if (!result) continue
    
    const type = parseTypeParam(result.params)
    const isPrimary = result.params.toUpperCase().includes('PREF') || result.params.includes('TYPE=pref')
    
    urls.push({
      value: result.value,
      type,
      isPrimary,
    })
  }
  
  // Mark first as primary if none marked
  if (urls.length > 0 && !urls.some(u => u.isPrimary)) {
    urls[0].isPrimary = true
  }
  
  return urls
}

function extractIMs(lines: string[]): ContactIM[] {
  const ims: ContactIM[] = []
  
  for (const line of lines) {
    if (!line.toUpperCase().startsWith('IMPP')) continue
    
    const result = parseLineWithParams(line, 'IMPP')
    if (!result) continue
    
    const type = parseTypeParam(result.params)
    const protocol = parseIMProtocol(result.params)
    const isPrimary = result.params.toUpperCase().includes('PREF') || result.params.includes('TYPE=pref')
    
    ims.push({
      value: result.value,
      type,
      protocol,
      isPrimary,
    })
  }
  
  // Mark first as primary if none marked
  if (ims.length > 0 && !ims.some(i => i.isPrimary)) {
    ims[0].isPrimary = true
  }
  
  return ims
}

function extractPhoto(lines: string[]): string | null {
  for (const line of lines) {
    if (!line.toUpperCase().startsWith('PHOTO')) continue
    
    // Handle inline base64
    if (line.toUpperCase().includes('ENCODING=B')) {
      const colonIndex = line.lastIndexOf(':')
      if (colonIndex >= 0) {
        const base64 = line.substring(colonIndex + 1)
        return `data:image/jpeg;base64,${base64}`
      }
    }
    
    // Handle URI
    if (line.toUpperCase().includes('VALUE=URI')) {
      const colonIndex = line.indexOf(':')
      if (colonIndex >= 0) {
        return line.substring(colonIndex + 1)
      }
    }
  }
  return null
}

function parseTypeParam(params: string): 'home' | 'work' | 'other' | 'pref' {
  const upper = params.toUpperCase()
  if (upper.includes('WORK')) return 'work'
  if (upper.includes('HOME')) return 'home'
  if (upper.includes('PREF')) return 'pref'
  return 'other'
}

function parsePhoneTypeParam(params: string): 'home' | 'work' | 'cell' | 'fax' | 'other' | 'pref' {
  const upper = params.toUpperCase()
  if (upper.includes('WORK')) return 'work'
  if (upper.includes('HOME')) return 'home'
  if (upper.includes('CELL') || upper.includes('MOBILE')) return 'cell'
  if (upper.includes('FAX')) return 'fax'
  if (upper.includes('PREF')) return 'pref'
  return 'other'
}

function parseIMProtocol(params: string): ContactIM['protocol'] {
  const upper = params.toUpperCase()
  if (upper.includes('AIM')) return 'aim'
  if (upper.includes('EMAIL')) return 'email'
  if (upper.includes('FACEBOOK')) return 'facebook'
  if (upper.includes('GOOGLE')) return 'google'
  if (upper.includes('IRC')) return 'irc'
  if (upper.includes('MSN')) return 'msn'
  if (upper.includes('QQ')) return 'qq'
  if (upper.includes('SKYPE')) return 'skype'
  if (upper.includes('TWITTER')) return 'twitter'
  if (upper.includes('XMPP') || upper.includes('JABBER')) return 'xmpp'
  return 'other'
}

function parseVCardDate(dateStr: string | null): string | null {
  if (!dateStr) return null
  
  // Handle YYYYMMDD format
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  
  // Handle YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr
  }
  
  // Handle date-time formats
  if (dateStr.includes('T')) {
    return dateStr.split('T')[0]
  }
  
  return null
}

function formatVCardDate(dateStr: string): string | null {
  if (!dateStr) return null
  
  // Convert YYYY-MM-DD to YYYYMMDD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr.replace(/-/g, '')
  }
  
  return dateStr
}

function buildTypeParams(type: string, isPrimary: boolean): string {
  const parts: string[] = []
  
  if (type !== 'other') {
    parts.push(`TYPE=${type}`)
  }
  
  if (isPrimary) {
    parts.push('TYPE=pref')
  }
  
  return parts.length > 0 ? ';' + parts.join(';') : ''
}

function buildIMParams(type: string, protocol: string, isPrimary: boolean): string {
  const parts: string[] = []
  
  if (type !== 'other') {
    parts.push(`TYPE=${type}`)
  }
  
  if (protocol !== 'other') {
    parts.push(`X-SERVICE-TYPE=${protocol}`)
  }
  
  if (isPrimary) {
    parts.push('TYPE=pref')
  }
  
  return parts.length > 0 ? ';' + parts.join(';') : ''
}

function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}
