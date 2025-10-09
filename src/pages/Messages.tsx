import { MessagesView } from "@/components/messages/MessagesView";

const Messages = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground mt-2">
          Communicate with doctors, pharmacies, and admins
        </p>
      </div>

      <MessagesView />
    </div>
  );
};

export default Messages;
