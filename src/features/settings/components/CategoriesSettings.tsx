import type { JSX } from 'react'
import { useState } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { EVENT_COLORS } from '@/store/settingsStore'
import type { Category } from '@/types/categories'
import styles from './Settings.module.css'

export function CategoriesSettings(): JSX.Element {
  const {
    categories,
    autoCategoryRules,
    events,
    addCategory,
    updateCategory,
    deleteCategory,
    addAutoCategoryRule,
    updateAutoCategoryRule,
    deleteAutoCategoryRule,
    updateEvent,
  } = useCalendarStore()

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(EVENT_COLORS[0])
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryColor, setEditCategoryColor] = useState('')

  const [newRuleKeywords, setNewRuleKeywords] = useState('')
  const [newRuleCategoryId, setNewRuleCategoryId] = useState('')
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [editRuleKeywords, setEditRuleKeywords] = useState('')

  const [showApplyModal, setShowApplyModal] = useState(false)
  const [pendingRule, setPendingRule] = useState<{ keywords: string[]; categoryId: string } | null>(null)

  const handleAddCategory = (): void => {
    if (!newCategoryName.trim()) return
    addCategory({
      id: crypto.randomUUID(),
      name: newCategoryName.trim(),
      color: newCategoryColor,
    })
    setNewCategoryName('')
    setNewCategoryColor(EVENT_COLORS[0])
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

  const handleAddRule = (): void => {
    if (!newRuleKeywords.trim() || !newRuleCategoryId) return
    const keywords = newRuleKeywords.split(',').map((k) => k.trim()).filter(Boolean)
    if (keywords.length === 0) return
    setPendingRule({ keywords, categoryId: newRuleCategoryId })
    setShowApplyModal(true)
  }

  const applyRuleToExistingEvents = (rule: { keywords: string[]; categoryId: string }): void => {
    const lowerKeywords = rule.keywords.map((k) => k.toLowerCase())
    events.forEach((event) => {
      const lowerTitle = event.title.toLowerCase()
      const matches = lowerKeywords.some((kw) => lowerTitle.includes(kw))
      if (matches) {
        const currentCategories = event.categories || []
        if (!currentCategories.includes(rule.categoryId)) {
          updateEvent(event.id, {
            categories: [...currentCategories, rule.categoryId],
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

  const handleUpdateRule = (id: string): void => {
    if (!editRuleKeywords.trim()) return
    const keywords = editRuleKeywords.split(',').map((k) => k.trim()).filter(Boolean)
    if (keywords.length === 0) return
    updateAutoCategoryRule(id, { keywords })
    setEditingRuleId(null)
    setEditRuleKeywords('')
  }

  const handleDeleteRule = (id: string): void => {
    deleteAutoCategoryRule(id)
  }

  const getCategoryById = (id: string): Category | undefined => {
    return categories.find((c) => c.id === id)
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Categories</h2>
      <p className={styles.sectionDescription}>
        Organize events with categories. Categories sync via iCalendar CATEGORIES property.
      </p>

      <div className={styles.settingRow}>
        <div className={styles.settingLabel}>
          <span className={styles.settingLabelText}>Add Category</span>
        </div>
        <div className={styles.categoryAddRow}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <div className={styles.colorPicker}>
            {EVENT_COLORS.map((color) => (
              <button
                key={color}
                className={`${styles.colorSwatch} ${newCategoryColor === color ? styles.selected : ''}`}
                style={{ backgroundColor: color }}
                onClick={() => setNewCategoryColor(color)}
                aria-label={`Select color ${color}`}
              />
            ))}
          </div>
          <button className={styles.button} onClick={handleAddCategory}>
            Add
          </button>
        </div>
      </div>

      {categories.length > 0 && (
        <div className={styles.categoryList}>
          {categories.map((category) => (
            <div key={category.id} className={styles.categoryItem}>
              {editingCategoryId === category.id ? (
                <>
                  <input
                    type="text"
                    className={styles.textInput}
                    value={editCategoryName}
                    onChange={(e) => setEditCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleUpdateCategory(category.id)}
                    autoFocus
                  />
                  <div className={styles.colorPickerSmall}>
                    {EVENT_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`${styles.colorSwatch} ${editCategoryColor === color ? styles.selected : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setEditCategoryColor(color)}
                        aria-label={`Select color ${color}`}
                      />
                    ))}
                  </div>
                  <button
                    className={styles.buttonSmall}
                    onClick={() => handleUpdateCategory(category.id)}
                  >
                    Save
                  </button>
                  <button
                    className={styles.buttonSmall}
                    onClick={() => setEditingCategoryId(null)}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <span
                    className={styles.categoryColorDot}
                    style={{ backgroundColor: category.color }}
                  />
                  <span className={styles.categoryName}>{category.name}</span>
                  <button
                    className={styles.buttonSmall}
                    onClick={() => {
                      setEditingCategoryId(category.id)
                      setEditCategoryName(category.name)
                      setEditCategoryColor(category.color)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.buttonSmall}
                    onClick={() => handleDeleteCategory(category.id)}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {categories.length === 0 && (
        <p className={styles.emptyText}>No categories yet. Add one above.</p>
      )}

      <div className={styles.divider} />

      <h3 className={styles.subsectionTitle}>Auto-Apply Rules</h3>
      <p className={styles.sectionDescription}>
        Automatically apply categories based on keywords in event titles.
      </p>

      <div className={styles.settingRow}>
        <div className={styles.settingLabel}>
          <span className={styles.settingLabelText}>Add Rule</span>
        </div>
        <div className={styles.ruleAddRow}>
          <input
            type="text"
            className={styles.textInput}
            placeholder="Keywords (comma-separated)"
            value={newRuleKeywords}
            onChange={(e) => setNewRuleKeywords(e.target.value)}
          />
          <select
            className={styles.select}
            value={newRuleCategoryId}
            onChange={(e) => setNewRuleCategoryId(e.target.value)}
          >
            <option value="">Select category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          <button
            className={styles.button}
            onClick={handleAddRule}
            disabled={!newRuleCategoryId || !newRuleKeywords.trim()}
          >
            Add Rule
          </button>
        </div>
      </div>

      {autoCategoryRules.length > 0 && (
        <div className={styles.categoryList}>
          {autoCategoryRules.map((rule) => {
            const category = getCategoryById(rule.categoryId)
            return (
              <div key={rule.id} className={styles.categoryItem}>
                {editingRuleId === rule.id ? (
                  <>
                    <input
                      type="text"
                      className={styles.textInput}
                      value={editRuleKeywords}
                      onChange={(e) => setEditRuleKeywords(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleUpdateRule(rule.id)}
                      autoFocus
                    />
                    <button
                      className={styles.buttonSmall}
                      onClick={() => handleUpdateRule(rule.id)}
                    >
                      Save
                    </button>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => setEditingRuleId(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className={styles.ruleKeywords}>
                      {rule.keywords.join(', ')}
                    </span>
                    <span className={styles.ruleArrow}>→</span>
                    <span
                      className={styles.categoryColorDot}
                      style={{ backgroundColor: category?.color || '#888' }}
                    />
                    <span className={styles.categoryName}>{category?.name || 'Unknown'}</span>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => {
                        setEditingRuleId(rule.id)
                        setEditRuleKeywords(rule.keywords.join(', '))
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.buttonSmall}
                      onClick={() => handleDeleteRule(rule.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {autoCategoryRules.length === 0 && (
        <p className={styles.emptyText}>No auto-apply rules yet. Add one above.</p>
      )}

      {showApplyModal && pendingRule && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Apply Rule to Existing Events?</h3>
            </div>
            <p className={styles.modalDescription}>
              This rule will apply the category "{getCategoryById(pendingRule.categoryId)?.name}" to events
              containing "{pendingRule.keywords.join(', ')}".
            </p>
            <p className={styles.modalDescription}>
              Would you like to apply this rule to existing events as well?
            </p>
            <div className={styles.modalFooter}>
              <button
                className={styles.buttonSecondary}
                onClick={() => confirmAddRule(false)}
              >
                Future Events Only
              </button>
              <button
                className={styles.buttonPrimary}
                onClick={() => confirmAddRule(true)}
              >
                All Events
              </button>
              <button
                className={styles.cancelButton}
                onClick={() => {
                  setShowApplyModal(false)
                  setPendingRule(null)
                  setNewRuleKeywords('')
                  setNewRuleCategoryId('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}