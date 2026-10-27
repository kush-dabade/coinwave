import { useState } from "react"
import { toast } from "sonner"

import { Switch } from "@/components/ui/controls"
import { updateSettings, useSettings } from "@/stores"

function permission(): NotificationPermission | "unsupported" {
  return typeof window !== "undefined" && "Notification" in window
    ? Notification.permission
    : "unsupported"
}

/** Opt-in switch for system notifications; asks the browser only on enable. */
export function NotificationsControl() {
  const settings = useSettings()
  const [perm, setPerm] = useState(permission)
  const enable = async (on: boolean) => {
    if (!on) return updateSettings({ notifications: false })
    if (perm === "unsupported")
      return toast.error("This browser doesn’t support notifications.")
    const result =
      perm === "granted" ? "granted" : await Notification.requestPermission()
    setPerm(result)
    if (result === "granted") updateSettings({ notifications: true })
    else
      toast.error(
        "Notifications are blocked for this site in your browser settings."
      )
  }
  return (
    <Switch
      label="Browser notifications"
      description={
        perm === "unsupported"
          ? "Not supported in this browser."
          : perm === "denied"
            ? "Blocked in your browser’s site settings; alerts still show inside CoinWave."
            : "Show a system notification when an alert triggers (CoinWave must be open)."
      }
      checked={settings.notifications && perm === "granted"}
      disabled={perm === "unsupported" || perm === "denied"}
      onChange={enable}
    />
  )
}
