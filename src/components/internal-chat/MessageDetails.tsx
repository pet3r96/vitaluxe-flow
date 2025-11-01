import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCheck, User, ExternalLink, Trash2, CheckCircle, RotateCcw, FolderOpen } from "lucide-react";
import { PriorityBadge } from "./PriorityBadge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface MessageDetailsProps {
  message: any;
  recipients: any[];
  onMarkComplete: () => Promise<void>;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function MessageDetails({
  message,
  recipients,
  onMarkComplete,
  onReopen,
  onDelete
}: MessageDetailsProps) {
  const navigate = useNavigate();

  if (!message) {
    return null;
  }

  return (
    <div className="w-full lg:w-[340px] border-l bg-background">
      <ScrollArea className="h-full p-6 space-y-6">
        {/* Message Info Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Message Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <div className="mt-1">
                <Badge variant="outline">
                  {message.message_type === 'patient_specific' ? 'Patient Message' :
                   message.message_type === 'announcement' ? 'Announcement' : 'General'}
                </Badge>
              </div>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Priority</label>
              <div className="mt-1">
                <PriorityBadge priority={message.priority || 'medium'} />
              </div>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Created</label>
              <p className="text-sm mt-1">{format(new Date(message.created_at), 'PPpp')}</p>
            </div>
            
            <div>
              <label className="text-xs text-muted-foreground">Sent By</label>
              <div className="flex items-center gap-2 mt-1">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {message.sender.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">{message.sender.name}</span>
              </div>
            </div>

            {message.completed && (
              <div>
                <label className="text-xs text-muted-foreground">Completed</label>
                <p className="text-sm mt-1">{format(new Date(message.completed_at), 'PPpp')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Patient Link Section */}
        {message.patient && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => navigate(`/patients/${message.patient_id}`)}
              >
                <User className="mr-2 h-4 w-4" />
                {message.patient.name}
                <ExternalLink className="ml-auto h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => navigate(`/patients/${message.patient_id}`)}
              >
                <FolderOpen className="mr-2 h-4 w-4" />
                View Patient File
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recipients Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recipients ({recipients.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recipients.map((recipient) => {
              const initials = recipient.name
                .split(' ')
                .map((n: string) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2);

              return (
                <div key={recipient.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{recipient.name}</p>
                      <p className="text-xs text-muted-foreground">{recipient.role_display}</p>
                    </div>
                  </div>
                  
                  {recipient.read_at ? (
                    <div className="flex items-center gap-1 text-green-600">
                      <CheckCheck className="h-4 w-4" />
                      <span className="text-xs">
                        {format(new Date(recipient.read_at), 'MMM dd')}
                      </span>
                    </div>
                  ) : (
                    <Badge variant="secondary" className="text-xs">Unread</Badge>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Actions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!message.completed ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onMarkComplete}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark as Complete
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={onReopen}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reopen Message
              </Button>
            )}
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Message
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Message</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this message? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </ScrollArea>
    </div>
  );
}
