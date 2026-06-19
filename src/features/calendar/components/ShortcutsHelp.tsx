import type { JSX } from 'react'
import { Modal } from '@/components/common/Modal'
import styles from './ShortcutsHelp.module.css'

interface Shortcut {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

const GROUPS: ShortcutGroup[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['T'], description: 'Jump to today' },
      { keys: ['<', ','], description: 'Previous view' },
      { keys: ['>', '.'], description: 'Next view' },
    ],
  },
  {
    title: 'Create',
    shortcuts: [
      { keys: ['C'], description: 'New event' },
      { keys: ['K'], description: 'New task' },
      { keys: ['\u2318', 'K'], description: 'Open command palette' },
    ],
  },
  {
    title: 'General',
    shortcuts: [
      { keys: ['?'], description: 'Show this help' },
      { keys: ['Esc'], description: 'Close modal / panel' },
    ],
  },
]

interface ShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
}

export function ShortcutsHelp({ isOpen, onClose }: ShortcutsHelpProps): JSX.Element {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" className={styles.modal}>
      <div className={styles.body}>
        {GROUPS.map((group) => (
          <section key={group.title} className={styles.group}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <ul className={styles.list}>
              {group.shortcuts.map((s) => (
                <li key={s.description} className={styles.row}>
                  <span className={styles.description}>{s.description}</span>
                  <span className={styles.keys}>
                    {s.keys.map((k, i) => (
                      <kbd key={i} className={styles.kbd}>
                        {k}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className={styles.hint}>
          Shortcuts are disabled while typing in an input or when a modal is open.
        </p>
      </div>
    </Modal>
  )
}
