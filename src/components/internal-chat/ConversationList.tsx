import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { MessageCard } from "./MessageCard";
import { Skeleton } from "@/components/ui/skeleton";

interface ConversationListProps {
  filterTab: 'active' | 'urgent' | 'patient' | 'completed';
  onFilterTabChange: (tab: 'active' | 'urgent' | 'patient' | 'completed') => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  patientFilter: string | null;
  onPatientFilterChange: (patientId: string | null) => void;
  selectedMessageId: string | null;
  onSelectMessage: (messageId: string) => void;
  onNewMessage: () => void;
  messages: any[];
  patients: any[];
  loading: boolean;
  unreadCount: number;
  activeCount: number;
  urgentCount: number;
}

export function ConversationList({
  filterTab,
  onFilterTabChange,
  searchQuery,
  onSearchChange,
  patientFilter,
  onPatientFilterChange,
  selectedMessageId,
  onSelectMessage,
  onNewMessage,
  messages,
  patients,
  loading,
  unreadCount,
  activeCount,
  urgentCount
}: ConversationListProps) {
  return (
    <div className="w-full lg:w-[340px] border-r flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Internal Chat</h2>
          <Button size="icon" onClick={onNewMessage}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={filterTab} onValueChange={(v) => onFilterTabChange(v as any)} className="px-4 pt-4">
        <TabsList className="w-full justify-between">
          <TabsTrigger value="active" className="text-xs flex-1">
            Active
            {activeCount > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">{activeCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="urgent" className="text-xs flex-1">
            Urgent
            {urgentCount > 0 && <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">{urgentCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="patient" className="text-xs flex-1">
            Patient
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs flex-1">
            Done
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="p-4 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={patientFilter || 'all'} onValueChange={(v) => onPatientFilterChange(v === 'all' ? null : v)}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by patient" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message List */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No messages found</p>
            <Button variant="link" onClick={onNewMessage} className="mt-2">
              Send your first message
            </Button>
          </div>
        ) : (
          messages.map((message) => (
            <MessageCard
              key={message.id}
              message={message}
              selected={message.id === selectedMessageId}
              onClick={() => onSelectMessage(message.id)}
            />
          ))
        )}
      </ScrollArea>
    </div>
  );
}
