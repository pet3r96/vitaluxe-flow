import { OrdersDataTable } from "@/components/orders/OrdersDataTable";

const Orders = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Order Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all orders across the system
        </p>
      </div>

      <OrdersDataTable />
    </div>
  );
};

export default Orders;
