import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

// Sample data - replace with real data from your backend
const data = [
  { name: "Pending", value: 12, color: "#F59E0B", gradient: "from-amber-400 to-amber-600" },
  { name: "Processing", value: 25, color: "#3B82F6", gradient: "from-blue-400 to-blue-600" },
  { name: "Completed", value: 63, color: "#10B981", gradient: "from-emerald-400 to-emerald-600" },
  { name: "Cancelled", value: 5, color: "#EF4444", gradient: "from-red-400 to-red-600" },
];

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
}: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-xs font-bold"
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

export function OrdersBreakdown() {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card variant="modern" className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Orders by Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col items-center">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <defs>
                {data.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={1} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.7} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderCustomizedLabel}
                outerRadius={90}
                innerRadius={55}
                fill="#8884d8"
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
                animationEasing="ease-out"
              >
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={`url(#gradient-${index})`}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                    strokeWidth={2}
                    stroke="hsl(var(--background))"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  boxShadow: "0 8px 16px rgba(0,0,0,0.15)",
                  padding: "12px",
                }}
                formatter={(value: number) => [`${value} orders`, "Count"]}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center text showing total - positioned absolutely in the donut center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <div className="text-3xl font-bold text-foreground animate-fade-in">{total}</div>
              <div className="text-xs text-muted-foreground">Total Orders</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          {data.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-br from-accent/30 to-accent/10 hover:from-accent/40 hover:to-accent/20 transition-all duration-200 group cursor-pointer"
            >
              <div
                className={`w-3 h-3 rounded-full bg-gradient-to-br ${item.gradient} group-hover:scale-110 transition-transform shadow-md`}
              />
              <div className="flex-1">
                <div className="text-xs font-medium text-foreground">{item.name}</div>
                <div className="text-lg font-bold text-foreground">{item.value}</div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                {((item.value / total) * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
