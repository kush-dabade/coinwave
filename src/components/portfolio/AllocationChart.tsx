import {
  Cell,
  PieChart,
  Pie,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";

type Props = {
  data: {
    symbol: string;
    allocation: number;
  }[];
};

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7"];

export default function AllocationChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState(-1);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={data}
            dataKey="allocation"
            nameKey="symbol"
            innerRadius={56}
            outerRadius={100}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(-1)}
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
            paddingAngle={2}
            cornerRadius={6}
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
          >
            {data.map((_, index) => (
              <Cell
                key={index}
                fill={COLORS[index % COLORS.length]}
                fillOpacity={activeIndex === -1 || activeIndex === index ? 1 : 0.5}
                stroke={activeIndex === index ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.15)"}
                strokeWidth={activeIndex === index ? 2 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            wrapperStyle={{
              transition: "transform 120ms ease-out",
              pointerEvents: "none",
            }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              return (
                <div className="rounded-lg border border-white/15 bg-neutral-900/95 px-3 py-2 text-xs text-white shadow-[0_14px_30px_-16px_rgba(0,0,0,0.9)] backdrop-blur-md">
                  <div className="font-medium">{String(item.name)}</div>
                  <div className="mt-1 text-white/75">
                    {Number(item.value).toFixed(2)}%
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
