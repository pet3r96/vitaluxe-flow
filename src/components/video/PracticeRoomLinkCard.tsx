import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Copy, Link2, Loader2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  practiceId: string;
}

export function PracticeRoomLinkCard({ practiceId }: Props) {
  const { toast } = useToast();
  const [showQR, setShowQR] = useState(false);

  const { data: roomData, isLoading } = useQuery({
    queryKey: ['practice-room-link', practiceId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-or-create-practice-room', {
        body: { practice_id: practiceId }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!practiceId
  });

  const roomUrl = roomData?.room?.roomKey 
    ? `${window.location.origin}/practice/video/room/${roomData.room.roomKey}`
    : '';

  const handleCopyLink = () => {
    if (roomUrl) {
      navigator.clipboard.writeText(roomUrl);
      toast({
        title: "Link copied",
        description: "Practice room link copied to clipboard",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Practice Room Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Universal Practice Room Link
        </CardTitle>
        <CardDescription>
          Share this permanent link with providers and staff in your practice. Anyone with this link can join your practice's video room.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input 
            value={roomUrl}
            readOnly
            className="font-mono text-sm"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopyLink}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowQR(!showQR)}
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>

        {showQR && roomUrl && (
          <div className="flex justify-center p-4 border rounded-lg bg-white">
            <img 
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(roomUrl)}`}
              alt="Practice Room QR Code"
              className="w-48 h-48"
            />
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1">
          <p>✓ Anyone in your practice can use this link</p>
          <p>✓ Link never expires</p>
          <p>✓ Automatically creates or joins active sessions</p>
        </div>
      </CardContent>
    </Card>
  );
}
