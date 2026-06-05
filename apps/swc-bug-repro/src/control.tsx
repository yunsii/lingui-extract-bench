// CONTROL: identical shape but no ambient declaration → all messages extracted.
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

// expected & actual: ["Your Credits", "Choose Pack", "Purchase"]
