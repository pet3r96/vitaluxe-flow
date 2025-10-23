import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressVerificationPanel } from "@/components/admin/AddressVerificationPanel";
import { EasyPostShipmentManager } from "@/components/admin/EasyPostShipmentManager";
import { OrphanedUserFixer } from "@/components/admin/OrphanedUserFixer";
import { PracticesDataTable } from "@/components/practices/PracticesDataTable";
import { ProvidersDataTable } from "@/components/providers/ProvidersDataTable";
import { RepsManagement } from "@/components/admin/RepsManagement";
import { PendingRepsApproval } from "@/components/admin/PendingRepsApproval";
import { PendingPracticesApproval } from "@/components/admin/PendingPracticesApproval";
import { ProductTypeManager } from "@/components/admin/ProductTypeManager";
import { MerchantFeeSettings } from "@/components/admin/MerchantFeeSettings";
import { OrderStatusManager } from "@/components/admin/OrderStatusManager";
import { TestPasswordManager } from "@/components/admin/TestPasswordManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Building2, Users, Wrench, Package, Settings, ListOrdered, DollarSign, AlertTriangle, Truck } from "lucide-react";
import { PriceOverrideManager } from "@/components/admin/PriceOverrideManager";
import { AdminPasswordChange } from "@/components/admin/AdminPasswordChange";
import { FactoryResetManager } from "@/components/admin/FactoryResetManager";

const AdminSettings = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage business operations, practices, providers, and system utilities
        </p>
      </div>

      <Tabs defaultValue="practices" className="space-y-4">
        <TabsList className="grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          <TabsTrigger value="practices" className="gap-2">
            <Building2 className="h-4 w-4" />
            Practices
          </TabsTrigger>
          <TabsTrigger value="providers" className="gap-2">
            <Users className="h-4 w-4" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="reps" className="gap-2">
            <Users className="h-4 w-4" />
            Representatives
          </TabsTrigger>
          <TabsTrigger value="pending-reps" className="gap-2">
            <Users className="h-4 w-4" />
            Pending Reps
          </TabsTrigger>
          <TabsTrigger value="pending-practices" className="gap-2">
            <Building2 className="h-4 w-4" />
            Pending Practices
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <MapPin className="h-4 w-4" />
            Address Verification
          </TabsTrigger>
          <TabsTrigger value="shipments" className="gap-2">
            <Truck className="h-4 w-4" />
            Tracking Tester
          </TabsTrigger>
          <TabsTrigger value="product-types" className="gap-2">
            <Package className="h-4 w-4" />
            Product Types
          </TabsTrigger>
          <TabsTrigger value="order-statuses" className="gap-2">
            <ListOrdered className="h-4 w-4" />
            Order Statuses
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-2">
            <Settings className="h-4 w-4" />
            System Settings
          </TabsTrigger>
          <TabsTrigger value="utilities" className="gap-2">
            <Wrench className="h-4 w-4" />
            Utilities
          </TabsTrigger>
          <TabsTrigger value="price-overrides" className="gap-2">
            <DollarSign className="h-4 w-4" />
            Price Overrides
          </TabsTrigger>
          
          <TabsTrigger value="danger-zone" className="gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="practices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Practice Management</CardTitle>
              <CardDescription>
                Manage all medical practices, view statistics, and control account status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PracticesDataTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Management</CardTitle>
              <CardDescription>
                Manage all medical providers across all practices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProvidersDataTable />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Representatives Management</CardTitle>
              <CardDescription>
                Manage topline and downline sales representatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RepsManagement />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-reps" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Representative Requests</CardTitle>
              <CardDescription>
                Review and approve/reject representative requests from topline and downline reps
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingRepsApproval />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending-practices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Practice Requests</CardTitle>
              <CardDescription>
                Review and approve/reject practice requests from representatives
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingPracticesApproval />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="addresses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Global Address Verification</CardTitle>
              <CardDescription>
                Validate and standardize addresses across all entities using EasyPost and ZIP validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddressVerificationPanel />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shipments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>EasyPost Tracking Tester</CardTitle>
              <CardDescription>
                Test the EasyPost tracking API with existing orders or manual tracking codes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EasyPostShipmentManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="product-types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Product Type Management</CardTitle>
              <CardDescription>
                Manage product categories used throughout the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProductTypeManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="order-statuses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Order Status Management</CardTitle>
              <CardDescription>
                Manage order status configurations and create custom statuses
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OrderStatusManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <MerchantFeeSettings />
        </TabsContent>

        <TabsContent value="utilities" className="space-y-4">
          <AdminPasswordChange />
          <TestPasswordManager />
          <OrphanedUserFixer />
        </TabsContent>

        <TabsContent value="price-overrides" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Rep Price Overrides</CardTitle>
              <CardDescription>
                Set custom pricing for specific representatives that overrides default product prices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PriceOverrideManager />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger-zone" className="space-y-4">
          <FactoryResetManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
