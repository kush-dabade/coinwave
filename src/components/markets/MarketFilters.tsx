import { motion } from "framer-motion"
import { Search } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type MarketTab = "all" | "gainers" | "losers" | "trending"
export type MarketSort = "market_cap" | "price" | "change_24h"

type MarketFiltersProps = {
  search: string
  onSearchChange: (value: string) => void
  activeTab: MarketTab
  onTabChange: (tab: MarketTab) => void
  sortBy: MarketSort
  onSortChange: (value: MarketSort) => void
}

const tabs: Array<{ key: MarketTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "trending", label: "Trending" },
]

export function MarketFilters({
  search,
  onSearchChange,
  activeTab,
  onTabChange,
  sortBy,
  onSortChange,
}: MarketFiltersProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 shadow-[0_18px_35px_-28px_rgba(0,0,0,0.9)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
      <div className="group relative w-full md:max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-white/40 transition-colors duration-200 group-focus-within:text-white/75" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search assets, symbols..."
          className="h-10 border-white/10 bg-black/30 pl-9 text-white placeholder:text-white/35 focus-visible:border-white/25 focus-visible:ring-2 focus-visible:ring-cyan-300/35 focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_0_24px_-8px_rgba(56,189,248,0.8)]"
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition duration-200 ${
                  active ? "text-white" : "text-white/55 hover:text-white/85"
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="markets-tab-pill"
                    className="absolute inset-0 -z-10 rounded-lg border border-white/15 bg-white/10 shadow-[0_8px_24px_-16px_rgba(255,255,255,0.8)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.85 }}
                  />
                ) : null}
                {tab.label}
              </button>
            )
          })}
        </div>

        <Select value={sortBy} onValueChange={(value) => onSortChange(value as MarketSort)}>
          <SelectTrigger className="h-10 w-full border-white/12 bg-black/30 text-white transition duration-200 focus:ring-2 focus:ring-cyan-300/35 md:w-[190px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-neutral-950 text-white">
            <SelectItem value="market_cap">Market Cap</SelectItem>
            <SelectItem value="price">Price</SelectItem>
            <SelectItem value="change_24h">24h %</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
