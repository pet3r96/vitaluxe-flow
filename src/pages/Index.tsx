import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Index = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div>
        <h1 className="text-4xl lg:text-5xl font-heading font-bold gold-text-modern mb-2">
          Welcome to VitaLuxe
        </h1>
        <p className="text-muted text-lg">
          Your luxury healthcare management platform
        </p>
      </div>

      {/* Grid of Glass Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card variant="glass" className="shadow-hover">
          <CardHeader>
            <CardTitle className="text-xl">Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              View your key metrics and insights at a glance.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="shadow-hover">
          <CardHeader>
            <CardTitle className="text-xl">Products</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Manage your luxury product catalog with ease.
            </p>
          </CardContent>
        </Card>

        <Card variant="glass" className="shadow-hover">
          <CardHeader>
            <CardTitle className="text-xl">Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Track and manage customer orders in real-time.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Badge Examples */}
      <Card variant="glass" className="shadow-elevated">
        <CardHeader>
          <CardTitle>Status Indicators</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <span className="accent-gold-primary px-4 py-2 rounded-full text-sm font-medium">
            In Progress
          </span>
          <span className="accent-success px-4 py-2 rounded-full text-sm font-medium">
            Completed
          </span>
          <span className="accent-gold-light px-4 py-2 rounded-full text-sm font-medium">
            Pending Review
          </span>
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
