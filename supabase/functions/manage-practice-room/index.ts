import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAuthClient } from '../_shared/supabaseAdmin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createAuthClient(req.headers.get('Authorization'));

    const { 
      action, 
      practiceId, 
      roomId, 
      name, 
      description, 
      color, 
      active, 
      capacity 
    } = await req.json();

    console.log('Managing practice room:', { action, practiceId, roomId });

    if (!action || !practiceId) {
      throw new Error('Action and practice ID are required');
    }

    let result;

    switch (action) {
      case 'create': {
        if (!name) {
          throw new Error('Room name is required');
        }

        const { data, error } = await supabaseClient
          .from('practice_rooms')
          .insert({
            practice_id: practiceId,
            name,
            description: description || null,
            color: color || '#3B82F6',
            active: active !== undefined ? active : true,
            capacity: capacity || 1,
          })
          .select()
          .single();

        if (error) throw error;
        result = { success: true, data };
        break;
      }

      case 'update': {
        if (!roomId) {
          throw new Error('Room ID is required for update');
        }

        const updateData: any = { updated_at: new Date().toISOString() };
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (color !== undefined) updateData.color = color;
        if (active !== undefined) updateData.active = active;
        if (capacity !== undefined) updateData.capacity = capacity;

        const { data, error } = await supabaseClient
          .from('practice_rooms')
          .update(updateData)
          .eq('id', roomId)
          .eq('practice_id', practiceId)
          .select()
          .single();

        if (error) throw error;
        result = { success: true, data };
        break;
      }

      case 'delete': {
        if (!roomId) {
          throw new Error('Room ID is required for delete');
        }

        const { error } = await supabaseClient
          .from('practice_rooms')
          .delete()
          .eq('id', roomId)
          .eq('practice_id', practiceId);

        if (error) throw error;
        result = { success: true };
        break;
      }

      default:
        throw new Error(`Invalid action: ${action}`);
    }

    console.log('Practice room operation successful:', result);

    return new Response(
      JSON.stringify(result),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in manage-practice-room:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});