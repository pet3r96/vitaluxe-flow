-- Populate order_status_configs table with standard statuses
INSERT INTO public.order_status_configs (status_key, display_name, color_class, sort_order, is_active, description) VALUES
  ('pending', 'Pending', 'yellow', 1, true, 'Order received and awaiting processing'),
  ('processing', 'Processing', 'blue', 2, true, 'Order is being prepared'),
  ('shipped', 'Shipped', 'green', 3, true, 'Order has been shipped to customer'),
  ('delivered', 'Delivered', 'green', 4, true, 'Order successfully delivered'),
  ('cancelled', 'Cancelled', 'red', 5, true, 'Order has been cancelled'),
  ('on_hold', 'On Hold', 'orange', 6, true, 'Order is temporarily on hold')
ON CONFLICT (status_key) DO NOTHING;