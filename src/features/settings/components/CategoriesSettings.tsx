import type { JSX } from 'react'
import { useState, useMemo } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { EVENT_COLORS } from '@/store/settingsStore'
import type { AutoCategoryRule } from '@/types/categories'
import styles from './Settings.module.css'

function countMatchingEvents(
  keywords: string[],
  events: { title: string; categories?: string[] }[]
): number {
  if (keywords.length === 0) return 0
  const lowerKeywords = keywords.map((k) => k.toLowerCase())
  return events.filter((e) => {
    const lowerTitle = e.title.toLowerCase()
    return lowerKeywords.some((kw) => lowerTitle.includes(kw))
  }).length
}

function KeywordInput({
  keywords,
  onChange,
}: {
  keywords: string[]
  onChange: (keywords: string[]) => void
}): JSX.Element {
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const newKeyword = inputValue.trim().toLowerCase()
      if (newKeyword && !keywords.includes(newKeyword)) {
        onChange([...keywords, newKeyword])
      }
      setInputValue('')
    } else if (e.key === 'Backspace' && inputValue === '' && keywords.length > 0) {
      onChange(keywords.slice(0, -1))
    }
  }

  const removeKeyword = (keyword: string): void => {
    onChange(keywords.filter((k) => k !== keyword))
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '4px 8px',
        borderRadius: '6px',
        border: '1px solid var(--line)',
        background: 'var(--canvas)',
        minHeight: '32px',
        alignItems: 'center',
        flex: 1,
      }}
    >
      {keywords.map((keyword) => (
        <span
          key={keyword}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '4px',
            background: 'var(--accent-soft)',
            color: 'var(--accent)',
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {keyword}
          <button
            type="button"
            onClick={() => removeKeyword(keyword)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'inherit',
              opacity: 0.6,
              fontSize: '14px',
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={keywords.length === 0 ? 'Type keywords separated by comma' : ''}
        style={{
          flex: 1,
          minWidth: '80px',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: '13px',
          color: 'var(--ink)',
          padding: '2px 0',
        }}
      />
    </div>
  )
}

export function CategoriesSettings(): JSX.Element {
  const categories = useCalendarStore((s) => s.categories)
  const calendars = useCalendarStore((s) => s.calendars)
  const addCategory = useCalendarStore((s) => s.addCategory)
  const updateCategory = useCalendarStore((s) => s.updateCategory)
  const deleteCategory = useCalendarStore((s) => s.deleteCategory)
  const events = useCalendarStore((s) => s.events)
  const autoCategoryRules = useCalendarStore((s) => s.autoCategoryRules)
  const addAutoCategoryRule = useCalendarStore((s) => s.addAutoCategoryRule)
  const updateAutoCategoryRule = useCalendarStore((s) => s.updateAutoCategoryRule)
  const deleteAutoCategoryRule = useCalendarStore((s) => s.deleteAutoCategoryRule)
  const useCategoryColors = useSettingsStore((s) => s.useCategoryColors)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  // Category editor state
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(EVENT_COLORS[0])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryColor, setEditCategoryColor] = useState('')

  // Auto-categorize rule editor state
  const [showAddRule, setShowAddRule] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [newRuleKeywords, setNewRuleKeywords] = useState<string[]>([])
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('')
  const [editRuleKeywords, setEditRuleKeywords] = useState<string[]>([])
  const [editRuleCategoryId, setEditRuleCategoryId] = useState('')

  const getEventCountForCategory = (categoryName: string): number => {
    return events.filter((e) => e.categories?.includes(categoryName)).length
  }

  // Category CRUD
  const handleAddCategory = (): void => {
    if (!newCategoryName.trim()) return
    addCategory({
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
    })
    setNewCategoryName('')
    setNewCategoryColor(EVENT_COLORS[0])
    setShowAddCategory(false)
  }

  const handleUpdateCategory = (id: string): void => {
    if (!editCategoryName.trim()) return
    updateCategory(id, { name: editCategoryName.trim(), color: editCategoryColor })
    setEditingCategoryId(null)
    setEditCategoryName('')
    setEditCategoryColor('')
  }

  const handleDeleteCategory = (id: string): void => {
    deleteCategory(id)
  }

  // Auto-categorize rule CRUD
  const handleAddRule = (): void => {
    if (newRuleKeywords.length === 0 || !newRuleCategoryId) return
    addAutoCategoryRule({
      id: crypto.randomUUID(),
      keywords: newRuleKeywords,
      categoryId: newRuleCategoryId,
    })
    setNewRuleKeywords([])
    setNewRuleCategoryId('')
    setShowAddRule(false)
  }

  const handleUpdateRule = (id: string): void => {
    if (editRuleKeywords.length === 0 || !editRuleCategoryId) return
    updateAutoCategoryRule(id, {
      keywords: editRuleKeywords,
      categoryId: editRuleCategoryId,
    })
    setEditingRuleId(null)
    setEditRuleKeywords([])
    setEditRuleCategoryId('')
  }

  const handleDeleteRule = (id: string): void => {
    deleteAutoCategoryRule(id)
  }

  const startEditRule = (rule: AutoCategoryRule): void => {
    setEditingRuleId(rule.id)
    setEditRuleKeywords([...rule.keywords])
    setEditRuleCategoryId(rule.categoryId)
  }

  const cancelEditRule = (): void => {
    setEditingRuleId(null)
    setEditRuleKeywords([])
    setEditRuleCategoryId('')
  }

  const cancelAddRule = (): void => {
    setShowAddRule(false)
    setNewRuleKeywords([])
    setNewRuleCategoryId('')
  }

  // Apply rules to existing events
  const handleApplyToExisting = (): void => {
    const { getState } = useCalendarStore
    const state = getState()
    let changesMade = 0

    for (const rule of state.autoCategoryRules) {
      const category = state.categories.find((c) => c.id === rule.categoryId)
      if (!category) continue

      const lowerKeywords = rule.keywords.map((k) => k.toLowerCase())

      for (const event of state.events) {
        const lowerTitle = event.title.toLowerCase()
        const matches = lowerKeywords.some((kw) => lowerTitle.includes(kw))
        if (!matches) continue

        const currentCategories = event.categories || []
        if (currentCategories.includes(category.name)) continue

        // Add the category
        useCalendarStore.getState().updateEvent(event.id, {
          categories: [...currentCategories, category.name],
        })
        changesMade++
      }
    }

    if (changesMade > 0) {
      console.log(`[AutoCategory] Applied rules to ${changesMade} events`)
    }
  }

  // Preview: events that would match but don't have the category yet
  const rulePreviews = useMemo(() => {
    return autoCategoryRules.map((rule) => {
      const category = categories.find((c) => c.id === rule.categoryId)
      if (!category) return { rule, matchingCount: 0, uncategorizedCount: 0, byCalendar: [] }

      const lowerKeywords = rule.keywords.map((k) => k.toLowerCase())
      let matchingCount = 0
      let uncategorizedCount = 0
      const byCalendar = new Map<string, number>()

      for (const event of events) {
        const lowerTitle = event.title.toLowerCase()
        const matches = lowerKeywords.some((kw) => lowerTitle.includes(kw))
        if (matches) {
          matchingCount++
          if (!event.categories?.includes(category.name)) {
            uncategorizedCount++
          }
          const calId = event.calendarId
          byCalendar.set(calId, (byCalendar.get(calId) || 0) + 1)
        }
      }

      const byCalendarArray = Array.from(byCalendar.entries()).map(([calId, count]) => {
        const cal = calendars.find((c) => c.id === calId)
        return { name: cal?.name || 'Unknown', count }
      })

      return { rule, matchingCount, uncategorizedCount, categoryName: category.name, byCalendar: byCalendarArray }
    })
  }, [autoCategoryRules, categories, events, calendars])

  // Preview for new rule being created
  const newRulePreview = useMemo(() => {
    if (newRuleKeywords.length === 0 || !newRuleCategoryId) return null
    const category = categories.find((c) => c.id === newRuleCategoryId)
    if (!category) return null

    const lowerKeywords = newRuleKeywords.map((k) => k.toLowerCase())
    let matchingCount = 0
    let uncategorizedCount = 0
    const byCalendar = new Map<string, number>()

    for (const event of events) {
      const lowerTitle = event.title.toLowerCase()
      const matches = lowerKeywords.some((kw) => lowerTitle.includes(kw))
      if (matches) {
        matchingCount++
        if (!event.categories?.includes(category.name)) {
          uncategorizedCount++
        }
        const calId = event.calendarId
        byCalendar.set(calId, (byCalendar.get(calId) || 0) + 1)
      }
    }

    const byCalendarArray = Array.from(byCalendar.entries()).map(([calId, count]) => {
      const cal = calendars.find((c) => c.id === calId)
      return { name: cal?.name || 'Unknown', count }
    })

    return { matchingCount, uncategorizedCount, categoryName: category.name, byCalendar: byCalendarArray }
  }, [newRuleKeywords, newRuleCategoryId, categories, events, calendars])

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Categories</h1>

      <div className={styles.group}>
        <div className={styles.row}>
          <div>
            <div className={styles.label}>Use category colors for events</div>
            <div className={styles.hint}>When disabled, events use their calendar color</div>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={useCategoryColors}
              onChange={() => updateSettings({ useCategoryColors: !useCategoryColors })}
            />
            <span className={styles.pill} />
            <span className={styles.knob} />
          </label>
        </div>
      </div>

      {/* Categories List */}
      <div className={styles.group}>
        <div className={styles.catList}>
          {categories.map((category) => (
            <div key={category.id} className={styles.catRow}>
              {editingCategoryId === category.id ? (
                <>
                  <div className={styles.swatches} style={{ gap: '4px' }}>
                    {EVENT_COLORS.slice(0, 8).map((color) => (
                      <button
                        key={color}
                        className={`${styles.swatch} ${editCategoryColor === color ? styles.swatchActive : ''}`}
                        style={{ '--swatch-color': color, width: '20px', height: '20px' } as React.CSSProperties}
                        onMouseDown={(e) => {
                          e.preventDefault()
                          setEditCategoryColor(color)
                        }}
                        type="button"
                      />
                    ))}
                  </div>
                  <input
                    type="text"
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(category.id)}
                    onBlur={() => handleUpdateCategory(category.id)}
                    autoFocus
                    style={{ flex: 1, padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--accent)', fontSize: '14px', fontWeight: 500, background: 'var(--canvas)', color: 'var(--ink)' }}
                  />
                  <span className={styles.catCount}>{getEventCountForCategory(category.name)} events</span>
                </>
              ) : (
                <>
                  <div
                    className={styles.catSwatch}
                    style={{ '--cat-color': category.color, cursor: 'pointer' } as React.CSSProperties}
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditCategoryName(category.name)
                      setEditCategoryColor(category.color)
                    }}
                    title="Click to change color"
                  />
                  <span
                    className={styles.catName}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditCategoryName(category.name)
                      setEditCategoryColor(category.color)
                    }}
                  >
                    {category.name}
                  </span>
                  <span className={styles.catCount}>{getEventCountForCategory(category.name)} events</span>
                  <div className={styles.catActions}>
                    <button
                      className={`${styles.catBtn} ${styles.catBtnDanger}`}
                      onClick={() => handleDeleteCategory(category.id)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}

          {showAddCategory ? (
            <div className={styles.catRow}>
              <input
                type="text"
                placeholder="Category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                autoFocus
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '14px', background: 'var(--canvas)', color: 'var(--ink)' }}
              />
              <div className={styles.swatches} style={{ gap: '4px' }}>
                {EVENT_COLORS.slice(0, 6).map((color) => (
                  <button
                    key={color}
                    className={`${styles.swatch} ${newCategoryColor === color ? styles.swatchActive : ''}`}
                    style={{ '--swatch-color': color, width: '22px', height: '22px' } as React.CSSProperties}
                    onClick={() => setNewCategoryColor(color)}
                    type="button"
                  />
                ))}
              </div>
              <button className={styles.actionBtn} onClick={handleAddCategory} type="button">Add</button>
              <button className={styles.actionBtn} onClick={() => setShowAddCategory(false)} type="button">Cancel</button>
            </div>
          ) : (
            <button className={styles.catAdd} onClick={() => setShowAddCategory(true)} type="button">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M8 2v12M2 8h12" />
              </svg>
              Add category
            </button>
          )}
        </div>
      </div>

      {/* Auto-categorize Rules */}
      <div className={styles.group}>
        <div style={{ padding: '16px 20px 12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)' }}>Auto-categorize</div>
          <div style={{ fontSize: '13px', color: 'var(--ink-3)', marginTop: '4px' }}>Assign categories to events automatically based on keywords in the title</div>
        </div>

        <div className={styles.catList}>
          {rulePreviews.map(({ rule, matchingCount, uncategorizedCount, categoryName, byCalendar }) => (
            <div key={rule.id} className={styles.catRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
              {editingRuleId === rule.id ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <KeywordInput keywords={editRuleKeywords} onChange={setEditRuleKeywords} />
                    <span style={{ fontSize: '13px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>→</span>
                    <select
                      value={editRuleCategoryId}
                      onChange={(e) => setEditRuleCategoryId(e.target.value)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--line)',
                        fontSize: '13px',
                        background: 'var(--canvas)',
                        color: 'var(--ink)',
                        minWidth: '120px',
                      }}
                    >
                      <option value="">Select category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                    <button className={styles.actionBtn} onClick={() => handleUpdateRule(rule.id)} type="button">Save</button>
                    <button className={styles.actionBtn} onClick={cancelEditRule} type="button">Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', flex: 1 }}>
                      {rule.keywords.map((kw) => (
                        <span
                          key={kw}
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: 'var(--accent-soft)',
                            color: 'var(--accent)',
                            fontSize: '12px',
                            fontWeight: 500,
                          }}
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--ink-2)' }}>→</span>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      fontSize: '12px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                    }}>
                      {categoryName}
                    </span>
                    <span className={styles.catCount}>
                      {matchingCount} match{matchingCount !== 1 ? 'es' : ''}
                      {uncategorizedCount > 0 && (
                        <span style={{ color: 'var(--accent)', marginLeft: '4px' }}>
                          ({uncategorizedCount} uncategorized)
                        </span>
                      )}
                    </span>
                    {byCalendar.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--ink-3)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {byCalendar.map((cal) => (
                          <span key={cal.name}>{cal.count} in {cal.name}</span>
                        ))}
                      </div>
                    )}
                    <div className={styles.catActions}>
                      <button className={styles.catBtn} onClick={() => startEditRule(rule)} type="button">Edit</button>
                      <button className={`${styles.catBtn} ${styles.catBtnDanger}`} onClick={() => handleDeleteRule(rule.id)} type="button">Delete</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}

          {showAddRule ? (
            <div className={styles.catRow} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <KeywordInput keywords={newRuleKeywords} onChange={setNewRuleKeywords} />
                <span style={{ fontSize: '13px', color: 'var(--ink-2)', whiteSpace: 'nowrap' }}>→</span>
                <select
                  value={newRuleCategoryId}
                  onChange={(e) => setNewRuleCategoryId(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--line)',
                    fontSize: '13px',
                    background: 'var(--canvas)',
                    color: 'var(--ink)',
                    minWidth: '120px',
                  }}
                >
                  <option value="">Select category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
                <button className={styles.actionBtn} onClick={handleAddRule} type="button">Add</button>
                <button className={styles.actionBtn} onClick={cancelAddRule} type="button">Cancel</button>
              </div>
              {newRulePreview && (
                <div style={{ fontSize: '12px', color: 'var(--ink-3)', paddingLeft: '4px' }}>
                  Will match {newRulePreview.matchingCount} event{newRulePreview.matchingCount !== 1 ? 's' : ''}
                  {newRulePreview.uncategorizedCount > 0 && (
                    <span> ({newRulePreview.uncategorizedCount} currently uncategorized)</span>
                  )}
                  {newRulePreview.byCalendar.length > 0 && (
                    <div style={{ marginTop: '4px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {newRulePreview.byCalendar.map((cal) => (
                        <span key={cal.name}>{cal.count} in {cal.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <button className={styles.catAdd} onClick={() => setShowAddRule(true)} type="button">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <path d="M8 2v12M2 8h12" />
              </svg>
              Add auto-categorize rule
            </button>
          )}

          {autoCategoryRules.length > 0 && (
            <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--line)' }}>
              <button
                className={styles.actionBtn}
                onClick={handleApplyToExisting}
                type="button"
              >
                Apply rules to existing events
              </button>
              <span style={{ fontSize: '12px', color: 'var(--ink-3)', marginLeft: '8px' }}>
                Retroactively categorize events that match your rules
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
