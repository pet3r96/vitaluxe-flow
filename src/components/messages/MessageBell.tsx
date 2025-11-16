import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMessageAlerts } from "@/hooks/useMessageAlerts";
import { useNavigate } from "react-router-dom";

export function MessageBell() {
  const { unreadCount } = useMessageAlerts();
  const navigate = useNavigate();

  const handleClick = () => {
    navigate("/messages");
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative"
      onClick={handleClick}
      aria-label={`Messages${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <MessageCircle className="h-5 w-5" />
      {unreadCount > 0 && (
        <Badge
          variant="destructive"
          size="xs"
          className="absolute -top-1 -right-1 min-w-[20px] min-h-[20px] h-5 flex items-center justify-center p-0 text-[10px] font-bold z-10"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </Badge>
      )}
    </Button>
  );
}
