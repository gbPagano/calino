#!/usr/bin/env node
/**
 * Updates sample-events.ics dates to the current month.
 * Run automatically via prebuild hook or manually: node scripts/update-sample-events.mjs
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const icsPath = join(rootDir, 'public', 'sample-events.ics')

function pad(num, len = 2) {
  return String(num).padStart(len, '0')
}

function updateICSDate(dateStr, monthDiff) {
  // Handles formats: YYYYMMDD, YYYYMMDDTHHMMSSZ
  if (!dateStr || dateStr.length < 8) return dateStr

  const year = parseInt(dateStr.slice(0, 4), 10)
  const month = parseInt(dateStr.slice(4, 6), 10)
  const day = parseInt(dateStr.slice(6, 8), 10)

  const now = new Date()
  const targetYear = now.getFullYear()
  const targetMonth = now.getMonth() + 1 // 1-indexed

  // Calculate target year considering month diff
  let newYear = targetYear
  let newMonth = targetMonth

  // If we're going back months, account for year change
  if (monthDiff < 0) {
    // Going backwards - e.g., March -> April 2026 is +1 month, but March 2025 -> April 2026 is +13
  }

  // Simple approach: shift to current month preserving day
  const paddedDay = pad(day)
  const paddedMonth = pad(newMonth)
  const paddedYear = String(newYear)

  let result = paddedYear + paddedMonth + paddedDay

  // Preserve time part if present
  if (dateStr.length > 8) {
    result += dateStr.slice(8)
  }

  return result
}

function processLine(line, monthDiff) {
  // Match date patterns in iCalendar format
  // DTSTART;VALUE=DATE:20260301
  // DTSTART:20260303T100000Z
  // DTEND;VALUE=DATE:20260302
  // DUE;VALUE=DATE:20260305
  // DTSTAMP:20260301T000000Z
  // CREATED:20260301T000000Z
  // COMPLETED:20260303T080000Z

  return line.replace(
    /((?:DTSTART|DTEND|DUE|DTSTAMP|CREATED|COMPLETED)(?:;[^:]*)?):(\d{8})(T\d{6}Z)?/g,
    (match, prefix, datePart, timePart) => {
      const updatedDate = updateICSDate(datePart, monthDiff)
      return `${prefix}:${updatedDate}${timePart || ''}`
    }
  )
}

async function main() {
  const icsContent = readFileSync(icsPath, 'utf-8')

  // Dates will be shifted to current month by updateICSDate, so these reference
  // values are only used for the log message below.
  const sampleYear = 2026
  const sampleMonth = 3 // March

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1 // 1-indexed

  const monthDiff = (currentYear - sampleYear) * 12 + (currentMonth - sampleMonth)

  console.log(`Updating sample-events.ics: shifting ${sampleMonth}/${sampleYear} → ${currentMonth}/${currentYear} (offset: ${monthDiff} months)`)

  if (monthDiff === 0) {
    console.log('Already in current month, no update needed.')
    return
  }

  const updatedContent = icsContent
    .split('\n')
    .map(line => processLine(line, monthDiff))
    .join('\n')

  writeFileSync(icsPath, updatedContent, 'utf-8')
  console.log('Updated sample-events.ics successfully.')
}

main().catch(err => {
  console.error('Error updating sample events:', err)
  process.exit(1)
})
