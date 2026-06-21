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
    <section className={`${styles.section} ${styles.sectionActive}`} data-component="notification-settings">
      <h1 className={styles.pageTitle}>Notifications</h1>

      <div className={styles.group}>
        <div className={styles.groupLabel}>Events</div>
        <div className={styles.row} data-component="setting-row" data-setting="desktop-notifications" data-value={String(enableDesktopNotifications)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Event Reminders</div>
            <div className={styles.rowDesc}>Get notified before events start</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="desktop-notifications">
              <input
                type="checkbox"
                checked={enableDesktopNotifications}
                aria-label="Event reminders"
                onChange={handleEnableNotifications}
                disabled={permissionStatus === 'denied'}
              />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={`${styles.row} ${!enableDesktopNotifications ? styles.rowDisabled : ''}`} data-component="setting-row" data-setting="sound-alerts" data-value={String(enableSoundAlerts)}>
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Sound Alerts</div>
            <div className={styles.rowDesc}>Play a sound when events are about to start</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="sound-alerts">
              <input
                type="checkbox"
                checked={enableSoundAlerts}
                aria-label="Sound alerts"
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
        <div className={styles.row} data-component="setting-row" data-setting="task-due-date-reminders">
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Task Due Date Reminders</div>
            <div className={styles.rowDesc}>Notify when a task's due date arrives</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="task-due-date-reminders">
              <input type="checkbox" defaultChecked aria-label="Task due date reminders" />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
        <div className={styles.row} data-component="setting-row" data-setting="overdue-task-badge">
          <div className={styles.rowInfo}>
            <div className={styles.rowLabel}>Overdue Task Badge</div>
            <div className={styles.rowDesc}>Show a badge on the app icon for overdue tasks</div>
          </div>
          <div className={styles.rowControl}>
            <label className={styles.toggle} data-component="toggle" data-setting="overdue-task-badge">
              <input type="checkbox" aria-label="Overdue task badge" />
              <span className={styles.pill} />
              <span className={styles.knob} />
            </label>
          </div>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.row} data-component="setting-row" data-setting="test-notification">
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
              data-component="action-button"
              data-action="test-notification"
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
