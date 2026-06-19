const BASE_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function getWeekdayLabels(firstDayOfWeek: number): string[] {
  const labels: string[] = []
  for (let i = 0; i < 7; i++) {
    labels.push(BASE_WEEKDAY_LABELS[(i + firstDayOfWeek) % 7]!)
  }
  return labels
}
