import type { JSX } from 'react'
import { useState } from 'react'
import { useCalendarStore } from '@/store/calendarStore'
import { useSettingsStore } from '@/store/settingsStore'
import { EVENT_COLORS } from '@/store/settingsStore'
import styles from './Settings.module.css'

export function CategoriesSettings(): JSX.Element {
  const categories = useCalendarStore((s) => s.categories)
  const addCategory = useCalendarStore((s) => s.addCategory)
  const updateCategory = useCalendarStore((s) => s.updateCategory)
  const deleteCategory = useCalendarStore((s) => s.deleteCategory)
  const events = useCalendarStore((s) => s.events)
  const useCategoryColors = useSettingsStore((s) => s.useCategoryColors)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(EVENT_COLORS[0])
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryColor, setEditCategoryColor] = useState('')

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
                          e.preventDefault() // Prevent input blur
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
    </section>
  )
}
