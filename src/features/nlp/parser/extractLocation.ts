export function extractLocation(input: string): string | undefined {
  const dateTimeWords = [
    'today',
    'tomorrow',
    'yesterday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
    'sat',
    'sun',
    'next week',
    'last week',
    'next month',
    'last month',
    'next year',
    'last year',
  ]

  const timeWords = ['morning', 'afternoon', 'evening', 'night', 'noon', 'midnight']

  const isTimeLike = (text: string): boolean => {
    const timePatterns = [
      /^\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i,
      /^\d{1,2}\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i,
      /^\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*-\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i,
      /^(?:morning|afternoon|evening|night|noon|midnight)$/i,
      /^\d{1,2}\s+(?:minute|minutes|hour|hours)$/i,
    ]
    const trimmed = text.trim().toLowerCase()
    return timePatterns.some((p) => p.test(trimmed))
  }

  const findDateTimePosition = (text: string): number => {
    const lower = text.toLowerCase()
    let earliest = text.length

    for (const word of dateTimeWords) {
      const pos = lower.indexOf(word)
      if (pos !== -1 && pos < earliest) {
        earliest = pos
      }
    }

    for (const word of timeWords) {
      const pos = lower.indexOf(word)
      if (pos !== -1 && pos < earliest) {
        earliest = pos
      }
    }

    return earliest
  }

  const extractAfterPreposition = (input: string, preposition: string): string | undefined => {
    const regex = new RegExp(`\\s+${preposition}\\s+(.+)$`, 'i')
    const match = input.match(regex)
    if (match && match[1]) {
      let afterPrep = match[1]
      // Strip leading 'the' after 'at' so "at the office" yields "office", not "the office"
      if (preposition === 'at') {
        afterPrep = afterPrep.replace(/^the\s+/i, '')
      }
      const dateTimePos = findDateTimePosition(afterPrep)
      let location = afterPrep.substring(0, dateTimePos).trim()
      location = location.replace(/^,+|,+$/g, '').trim()
      if (location.length >= 2 && !isTimeLike(location)) {
        return location
      }
    }
    return undefined
  }

  const patterns = [
    /\bin\s+([a-zA-ZæøåÆØÅ]+(?:\s+[a-zA-ZæøåÆØÅ]+)*?)\b(?=\s*(?:tomorrow|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at|on|for)\b)/i,
    /\bat\s+([a-zA-ZæøåÆØÅ]+(?:\s+[a-zA-ZæøåÆØÅ]+)*?)\b(?=\s*(?:tomorrow|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at|on|for)\b)/i,
    /\b@\s*([a-zA-ZæøåÆØÅ]+(?:\s+[a-zA-ZæøåÆØÅ]+)*?)\b(?=\s*(?:tomorrow|yesterday|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday|at|on|for)\b)/i,
  ]

  for (const pattern of patterns) {
    const match = input.match(pattern)
    if (match && match[1]) {
      let location = match[1].trim()
      // Strip leading 'the' when extracted via 'at' preposition pattern
      location = location.replace(/^the\s+/i, '')
      location = location.replace(/^,+|,+$/g, '').trim()
      if (location.length >= 2 && !isTimeLike(location)) {
        return location
      }
    }
  }

  const loc = extractAfterPreposition(input, 'in')
  if (loc) return loc

  const loc2 = extractAfterPreposition(input, 'at')
  if (loc2) return loc2

  const loc3 = extractAfterPreposition(input, '@')
  if (loc3) return loc3

  const simpleAtMatch = input.match(/\bat\s+([a-zA-Z][a-zA-Z\s,]+)$/i)
  if (simpleAtMatch && simpleAtMatch[1]) {
    let location = simpleAtMatch[1].trim()
    // Strip leading 'the' after 'at'
    location = location.replace(/^the\s+/i, '')
    const dateTimePos = findDateTimePosition(location)
    if (dateTimePos < location.length) {
      location = location.substring(0, dateTimePos)
    }
    location = location.replace(/^,+|,+$/g, '').trim()
    if (location.length >= 2 && !isTimeLike(location)) {
      return location
    }
  }

  return undefined
}
