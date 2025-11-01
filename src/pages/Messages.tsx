import { MessagesView } from "@/components/messages/MessagesView";
import { ResponsivePage } from "@/components/layout/ResponsivePage";

const Messages = () => {
  return (
    <ResponsivePage
      title="Messages"
      subtitle="Support tickets and order issue communications"
    >
      <MessagesView />
    </ResponsivePage>
  );
};

export default Messages;
