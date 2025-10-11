import { MessagesView } from "@/components/messages/MessagesView";
import { PracticeProfileForm } from "@/components/profile/PracticeProfileForm";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, User } from "lucide-react";

const Messages = () => {
  const { effectiveRole } = useAuth();
  const isPractice = effectiveRole === "doctor"; // doctor role represents practices

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground">Messages & Profile</h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          Manage your support tickets and professional information
        </p>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList>
          <TabsTrigger value="inbox">
            <MessageCircle className="h-4 w-4 mr-2" />
            Inbox / Conversations
          </TabsTrigger>
          {isPractice && (
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              My Profile
            </TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="inbox" className="mt-6">
          <MessagesView />
        </TabsContent>
        
        {isPractice && (
          <TabsContent value="profile" className="mt-6">
            <PracticeProfileForm />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default Messages;
