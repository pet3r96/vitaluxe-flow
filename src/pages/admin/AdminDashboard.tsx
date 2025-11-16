import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, Building2, Pill, ShoppingCart, AlertCircle } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  // Fetch dashboard statistics
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const [usersRes, practicesRes, ordersRes, productsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('active', true),
        supabase.from('orders').select('id, total_amount, status', { count: 'exact' }),
        supabase.from('products').select('id', { count: 'exact', head: true }),
      ]);

      return {
        totalUsers: usersRes.count || 0,
        activePractices: practicesRes.count || 0,
        totalOrders: ordersRes.count || 0,
        totalRevenue: ordersRes.data?.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0) || 0,
        totalProducts: productsRes.count || 0,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">System overview and statistics</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">All registered users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Practices</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activePractices || 0}</div>
              <p className="text-xs text-muted-foreground">Active practice accounts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
              <p className="text-xs text-muted-foreground">All time orders</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${((stats?.totalRevenue || 0) / 100).toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">From all orders</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common administrative tasks</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <a href="/accounts" className="flex items-center gap-2 p-4 border rounded-lg hover:bg-accent transition-colors">
            <Users className="h-5 w-5" />
            <span>Manage Users</span>
          </a>
          <a href="/admin/practices" className="flex items-center gap-2 p-4 border rounded-lg hover:bg-accent transition-colors">
            <Building2 className="h-5 w-5" />
            <span>Manage Practices</span>
          </a>
          <a href="/admin/orders" className="flex items-center gap-2 p-4 border rounded-lg hover:bg-accent transition-colors">
            <ShoppingCart className="h-5 w-5" />
            <span>View Orders</span>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
