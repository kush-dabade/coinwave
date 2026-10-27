import { Link } from "react-router-dom"

import { EmptyState } from "@/components/data/states"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/controls"
import { usePageTitle } from "@/hooks/use-ui"

export default function NotFoundPage() {
  usePageTitle("Page not found")
  return (
    <Page className="py-16">
      <h1 className="sr-only">Page not found</h1>
      <EmptyState
        title="There’s nothing at this address"
        action={
          <>
            <Button asChild variant="primary" size="sm">
              <Link to="/">Go to the Command Center</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/markets">Browse markets</Link>
            </Button>
          </>
        }
      >
        The page may have moved, or the link may be mistyped. Press <Kbd>/</Kbd>{" "}
        to search for an asset or page.
      </EmptyState>
    </Page>
  )
}
