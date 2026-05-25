import { eachHourOfInterval, startOfDay, endOfDay } from 'date-fns'

export const HOURS = eachHourOfInterval({
  start: startOfDay(new Date()),
  end: endOfDay(new Date()),
})
