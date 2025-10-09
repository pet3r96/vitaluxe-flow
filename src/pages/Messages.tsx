import { Card } from "@/components/ui/card";

const Messages = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold gold-text-gradient">Messages</h1>
        <p className="text-muted-foreground mt-2">
          View and send messages
        </p>
      </div>

      <Card className="p-6 bg-card border-border shadow-gold">
        <p className="text-muted-foreground">
          No messages found.
        </p>
      </Card>
    </div>
  );
};

export default Messages;
