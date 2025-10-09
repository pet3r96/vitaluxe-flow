import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Package, ShoppingCart, Users, DollarSign } from "lucide-react";

const Dashboard = () => {
  const { user, userRole } = useAuth();

  const stats = [
    {
      title: "Total Orders",
      value: "0",
      icon: ShoppingCart,
      description: "Orders this month",
    },
    {
      title: "Products",
      value: "0",
      icon: Package,
      description: "Active products",
    },
    {
      title: "Users",
      value: "0",
      icon: Users,
      description: "Active accounts",
    },
    {
      title: "Revenue",
      value: "$0",
      icon: DollarSign,
      description: "Total revenue",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user?.email}
        </p>
        {userRole && (
          <p className="text-sm text-primary mt-1 capitalize">
            Role: {userRole}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card
            key={stat.title}
            className="p-6 bg-card border-border shadow-gold hover:glow-gold transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <stat.icon className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-sm font-medium text-muted-foreground">
              {stat.title}
            </h3>
            <p className="text-3xl font-bold text-foreground mt-2">
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {stat.description}
            </p>
          </Card>
        ))}
      </div>

      <Card className="p-6 bg-card border-border shadow-gold">
        <h2 className="text-2xl font-semibold mb-4 text-primary">
          Recent Activity
        </h2>
        <p className="text-muted-foreground">
          No recent activity to display.
        </p>
      </Card>
    </div>
  );
};

export default Dashboard;
