import { OrdersDataTable } from "@/components/orders/OrdersDataTable";

const Orders = () => {
  return (
    <div className="patient-container">
      <div className="mb-8">
        <h1 className="text-3xl sm:text-4xl font-bold gold-text-gradient">Order Management</h1>
        <p className="text-muted-foreground mt-2">
          View and manage all orders across the system
        </p>
      </div>

      <OrdersDataTable />
    </div>
  );
};

export default Orders;
