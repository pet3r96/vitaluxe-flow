import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

// Sample data - replace with real data from your backend
const data = [
  { name: "Pending", value: 12, color: "hsl(48 96% 53%)" },
  { name: "Processing", value: 25, color: "hsl(199 89% 48%)" },
  { name: "Completed", value: 63, color: "hsl(142 76% 36%)" },
  { name: "Cancelled", value: 5, color: "hsl(0 72% 51%)" },
];

export function OrdersBreakdown() {
  return (
    <Card variant="modern">
      <CardHeader>
        <CardTitle className="text-lg font-bold">Orders by Status</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="name" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              }}
              formatter={(value: number) => [`${value} orders`, "Count"]}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-accent/30">
              <span className="text-xs font-medium">{item.name}</span>
              <Badge variant="secondary" size="sm">{item.value}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
