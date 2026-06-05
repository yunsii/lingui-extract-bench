// WORKAROUND: keep the ambient declaration AFTER all message-bearing code
// (or, better in practice, move it to a separate `*.d.ts` file). With nothing
// after the `declare` block, every message is extracted correctly.
import { Trans } from "@lingui/react/macro"

function FirstCard() {
  return <Trans>Your Credits</Trans>
}

export function Page() {
  return (
    <div>
      <Trans>Choose Pack</Trans>
      <Trans>Purchase</Trans>
    </div>
  )
}

// ambient declaration moved to the very end → nothing is dropped
declare global {
  interface Window {
    updateCurrentCredits?: (credits: number) => void
  }
}

// expected & actual: ["Your Credits", "Choose Pack", "Purchase"]
