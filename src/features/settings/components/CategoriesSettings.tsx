import type { JSX } from 'react'
import { useState } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { EVENT_COLORS } from '@/store/settingsStore'
import styles from './Settings.module.css'

export function CategoriesSettings(): JSX.Element {
  const categories = useCalendarStore((s) => s.categories)
  const autoCategoryRules = useCalendarStore((s) => s.autoCategoryRules)
  const addCategory = useCalendarStore((s) => s.addCategory)
  const updateCategory = useCalendarStore((s) => s.updateCategory)
  const deleteCategory = useCalendarStore((s) => s.deleteCategory)
  const addAutoCategoryRule = useCalendarStore((s) => s.addAutoCategoryRule)
  const updateAutoCategoryRule = useCalendarStore((s) => s.updateAutoCategoryRule)
  const deleteAutoCategoryRule = useCalendarStore((s) => s.deleteAutoCategoryRule)
  const updateEvent = useCalendarStore((s) => s.updateEvent)
  const events = useCalendarStore((s) => s.events)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(EVENT_COLORS[0])
  const [showAddCategory, setShowAddCategory] = useState(false)

  const [newRuleKeywords, setNewRuleKeywords] = useState('')
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('')
  const [showAddRule, setShowAddRule] = useState(false)

  const [showApplyModal, setShowApplyModal] = useState(false)
  const [pendingRule, setPendingRule] = useState<{ keywords: string[]; categoryId: string } | null>(null)

  const getEventCountForCategory = (categoryName: string): number => {
    return events.filter((e) => e.categories?.includes(categoryName)).length
  }

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

  const handleDeleteCategory = (id: string): void => {
    deleteCategory(id)
  }

  const handleAddRule = (): void => {
    if (!newRuleKeywords.trim() || !newRuleCategoryId) return
    const keywords = newRuleKeywords.split(',').map((k) => k.trim()).filter(Boolean)
    if (keywords.length === 0) return
    setPendingRule({ keywords, categoryId: newRuleCategoryId })
    setShowApplyModal(true)
  }

  const applyRuleToExistingEvents = (rule: { keywords: string[]; categoryId: string }): void => {
    const category = categories.find((c) => c.id === rule.categoryId)
    if (!category) return
    const categoryName = category.name
    const lowerKeywords = rule.keywords.map((k) => k.toLowerCase())
    events.forEach((event) => {
      const lowerTitle = event.title.toLowerCase()
      const matches = lowerKeywords.some((kw) => lowerTitle.includes(kw))
      if (matches) {
        const currentCategories = event.categories || []
        if (!currentCategories.includes(categoryName)) {
          updateEvent(event.id, {
            categories: [...currentCategories, categoryName],
          })
        }
      }
    })
  }

  const confirmAddRule = (applyToExisting: boolean): void => {
    if (!pendingRule) return
    addAutoCategoryRule({
      id: crypto.randomUUID(),
      keywords: pendingRule.keywords,
      categoryId: pendingRule.categoryId,
    })
    if (applyToExisting) {
      applyRuleToExistingEvents(pendingRule)
    }
    setShowApplyModal(false)
    setPendingRule(null)
    setNewRuleKeywords('')
    setNewRuleCategoryId('')
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Categories</h1>

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
                        onClick={() => setEditCategoryColor(color)}
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

      {showApplyModal && pendingRule && (
        <div className={styles.modal} style={{ position: 'fixed', inset: 0, background: 'var(--modal-scrim)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className={styles.modalContent} style={{ background: 'var(--modal-bg)', border: '1px solid var(--modal-border)', boxShadow: 'var(--modal-shadow)', borderRadius: '18px', padding: '24px', maxWidth: '400px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)', marginBottom: '12px' }}>Apply Rule to Existing Events?</h3>
            <p style={{ fontSize: '14px', color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: '20px' }}>
              This rule will apply the category to events matching your keywords. Would you like to apply it to existing events as well?
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button className={styles.actionBtn} onClick={() => confirmAddRule(false)} type="button">Future Only</button>
              <button className={styles.actionBtn} style={{ background: 'var(--accent)', color: '#fff', border: 'none' }} onClick={() => confirmAddRule(true)} type="button">All Events</button>
              <button className={styles.actionBtn} onClick={() => { setShowApplyModal(false); setPendingRule(null) }} type="button">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
