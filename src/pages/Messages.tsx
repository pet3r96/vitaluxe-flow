import { MessagesView } from "@/components/messages/MessagesView";
import { ResponsivePage } from "@/components/layout/ResponsivePage";
import { useAuth } from "@/contexts/AuthContext";

const Messages = () => {
  const { effectiveRole } = useAuth();
  
  // Different subtitle based on role
  const subtitle = (effectiveRole === 'topline' || effectiveRole === 'downline')
    ? "Contact admin support team"
    : "Support tickets and order issue communications";
    
  return (
    <ResponsivePage
      title="Messages"
      subtitle={subtitle}
    >
      <MessagesView />
    </ResponsivePage>
  );
};

export default Messages;
