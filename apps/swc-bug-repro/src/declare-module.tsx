// BUG: a `declare module` block at the top of the file makes lingui-swc extract
// ZERO messages from the whole file. Babel extracts both.
// Mirrors a real TipTap extension file (module augmentation + a React view).
import { Trans } from "@lingui/react/macro"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    featureTag: {
      insertFeatureTag: (type: string) => ReturnType
    }
  }
}

export function FeatureTagView() {
  return (
    <Tooltip title={<Trans>Click to erase</Trans>} placement="top">
      <Trans>Feature tag</Trans>
    </Tooltip>
  )
}

// expected messages: ["Click to erase", "Feature tag"]
// lingui-swc actual: [] (both missed)
declare const Tooltip: any
