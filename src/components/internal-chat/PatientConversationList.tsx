import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCard } from "./MessageCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface PatientConversationListProps {
  filter: 'active' | 'urgent' | 'resolved';
  setFilter: (filter: 'active' | 'urgent' | 'resolved') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedPatient: string;
  setSelectedPatient: (patient: string) => void;
  messages: any[];
  patients: any[];
  isLoading: boolean;
  selectedMessageId: string | null;
  onSelectMessage: (messageId: string) => void;
  onNewMessage: () => void;
  unreadCount: number;
  activeCount: number;
  urgentCount: number;
}

export function PatientConversationList({
  filter,
  setFilter,
  searchQuery,
  setSearchQuery,
  selectedPatient,
  setSelectedPatient,
  messages,
  patients,
  isLoading,
  selectedMessageId,
  onSelectMessage,
  onNewMessage,
  unreadCount,
  activeCount,
  urgentCount,
}: PatientConversationListProps) {
  return (
    <div className="w-full lg:w-[380px] flex flex-col border-r bg-background">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Patient Messages</h2>
          <Button size="icon" onClick={onNewMessage}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
        </p>

        {/* Tabs */}
        <Tabs value={filter} onValueChange={setFilter} className="w-full">
          <TabsList className="w-full justify-between">
            <TabsTrigger value="active" className="text-xs flex-1">
              Active
              {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{activeCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="urgent" className="text-xs flex-1">
              Urgent
              {urgentCount > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">{urgentCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-xs flex-1">
              Resolved
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search & Filter */}
      <div className="p-4 space-y-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedPatient || 'all'} onValueChange={(v) => setSelectedPatient(v === 'all' ? '' : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by patient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No messages found</p>
            <Button size="sm" variant="outline" onClick={onNewMessage}>
              Send New Message
            </Button>
          </div>
        ) : (
          <div>
            {messages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                selected={selectedMessageId === message.id}
                onClick={() => onSelectMessage(message.id)}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
