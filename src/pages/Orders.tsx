import { OrdersDataTable } from "@/components/orders/OrdersDataTable";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

// Orders page component
const Orders = () => {
  return (
    <ResponsivePage
      title="Order Management"
      subtitle="View and manage all orders across the system"
    >
      <OrdersDataTable />
    </ResponsivePage>
  );
};

export default Orders;
