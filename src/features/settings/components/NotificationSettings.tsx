import type { JSX } from 'react'
import { useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { showTestNotification, requestNotificationPermission, getNotificationPermission } from '@/lib/notifications'
import styles from './Settings.module.css'

export function NotificationSettings(): JSX.Element {
  const enableDesktopNotifications = useSettingsStore((s) => s.enableDesktopNotifications)
  const enableSoundAlerts = useSettingsStore((s) => s.enableSoundAlerts)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const [permissionStatus, setPermissionStatus] = useState(getNotificationPermission)

  const handleEnableNotifications = async (): Promise<void> => {
    if (permissionStatus === 'default') {
      const newPermission = await requestNotificationPermission()
      setPermissionStatus(newPermission)
      if (newPermission !== 'granted') {
        return
      }
    }
    if (permissionStatus === 'denied') {
      return
    }
    updateSettings({ enableDesktopNotifications: !enableDesktopNotifications })
  }

  const handleTestNotification = async (): Promise<void> => {
    if (permissionStatus === 'default') {
      const newPermission = await requestNotificationPermission()
      setPermissionStatus(newPermission)
      if (newPermission !== 'granted') {
        return
      }
    }
    showTestNotification()
  }

  return (
    <section className={`${styles.section} ${styles.sectionActive}`}>
      <h1 className={styles.pageTitle}>Notifications</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Events</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Event Reminders</div>
            <div className={styles.rowDesc}>Get notified before events start</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={enableDesktopNotifications}
                onChange={handleEnableNotifications}
                disabled={permissionStatus === 'denied'}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={`${styles.row} ${!enableDesktopNotifications ? styles.rowDisabled : ''}`}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Sound Alerts</div>
            <div className={styles.rowDesc}>Play a sound when events are about to start</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={enableSoundAlerts}
                onChange={() => updateSettings({ enableSoundAlerts: !enableSoundAlerts })}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Tasks</div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Task Due Date Reminders</div>
            <div className={styles.rowDesc}>Notify when a task's due date arrives</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input type="checkbox" defaultChecked />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Overdue Task Badge</div>
            <div className={styles.rowDesc}>Show a badge on the app icon for overdue tasks</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle}>
              <input type="checkbox" />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.row}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Test Notification</div>
            <div className={styles.rowDesc}>
              {permissionStatus === 'default'
                ? 'Click to enable notifications and test'
                : permissionStatus === 'denied'
                  ? 'Notifications are blocked in browser settings'
                  : 'Send a test notification'}
            </div>
          </div>
          <div className={styles.rowControl}>
            <button
              className={styles.actionBtn}
              onClick={handleTestNotification}
              disabled={permissionStatus === 'denied'}
              type="button"
            >
              {permissionStatus === 'default' ? 'Enable & Test' : 'Send Test'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
