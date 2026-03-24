import { Button } from "./ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "./ui/card"

const Dashboard = () => {
  return (
    <div className="my-6">
      <Card className="border-white/10 bg-white/5 px-4 py-4">
        <CardHeader className="mb-4 flex flex-row items-start justify-between p-0">
          {/* Title Section */}
          <div>
            <CardTitle className="text-xl font-semibold tracking-tight">
              Market Overview
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-white/60">
              Welcome back, Admin. Here's what's happening today.
            </CardDescription>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 rounded-md bg-white/5 p-1">
            <Button
              variant="secondary"
              className="rounded-md px-4 py-1.5 text-sm font-medium"
            >
              Portfolio
            </Button>

            <Button
              variant="green"
              className="rounded-md px-4 py-1.5 text-sm font-medium"
            >
              P&L
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Future content (charts / stats) */}
          <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-white/10 text-sm text-white/40">
            Data coming soon...
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default Dashboard
