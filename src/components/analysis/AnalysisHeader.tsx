import { motion } from "framer-motion"

export type AnalysisTimeframe = "1D" | "7D" | "1M" | "1Y"

type AnalysisHeaderProps = {
  timeframe: AnalysisTimeframe
  onTimeframeChange: (next: AnalysisTimeframe) => void
}

const TIMEFRAMES: AnalysisTimeframe[] = ["1D", "7D", "1M", "1Y"]

export function AnalysisHeader({ timeframe, onTimeframeChange }: AnalysisHeaderProps) {
  return (
    <header className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Market Analysis</h1>
        <p className="text-sm text-white/55">Insights and trends across the crypto market</p>
      </div>

      <div className="inline-flex rounded-xl border border-white/10 bg-white/5 p-1">
        {TIMEFRAMES.map((option) => {
          const active = option === timeframe
          return (
            <button
              key={option}
              onClick={() => onTimeframeChange(option)}
              className={`relative rounded-lg px-3 py-1.5 text-xs font-medium tracking-wide transition ${
                active ? "text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="analysis-timeframe-pill"
                  className="absolute inset-0 rounded-lg border border-white/15 bg-white/10"
                  transition={{ type: "spring", stiffness: 360, damping: 28 }}
                />
              ) : null}
              <span className="relative z-10">{option}</span>
            </button>
          )
        })}
      </div>
    </header>
  )
}

