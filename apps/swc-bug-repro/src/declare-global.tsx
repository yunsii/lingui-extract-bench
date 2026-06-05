// BUG (partial): messages BEFORE a `declare global` block are extracted, messages
// AFTER it are silently skipped. Mirrors a real Next.js page that augments Window
// between two components.
import { Trans } from "@lingui/react/macro"

function FirstCard() {
  return <Trans>Your Credits</Trans> // extracted OK (before declare)
}

declare global {
  interface Window {
    updateCurrentCredits?: (credits: number) => void
  }
}

export function Page() {
  return (
    <div>
      <Trans>Choose Pack</Trans> {/* MISSED (after declare) */}
      <Trans>Purchase</Trans> {/* MISSED (after declare) */}
    </div>
  )
}

// expected: ["Your Credits", "Choose Pack", "Purchase"]
// lingui-swc actual: ["Your Credits"]  (everything after `declare global` dropped)
