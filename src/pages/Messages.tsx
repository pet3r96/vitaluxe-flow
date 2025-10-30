import { MessagesView } from "@/components/messages/MessagesView";

const Messages = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Messages</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Support tickets go to Admin • Order issues go to assigned Pharmacy
        </p>
      </div>

      <MessagesView />
    </div>
  );
};

export default Messages;
