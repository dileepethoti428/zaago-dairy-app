import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type CollectionCenter = Database['public']['Tables']['collection_centers']['Row'];
type CollectionCenterInsert = Database['public']['Tables']['collection_centers']['Insert'];
type CollectionCenterUpdate = Database['public']['Tables']['collection_centers']['Update'];

// Fetch all collection centers (including inactive for admin)
export function useAllCollectionCenters() {
  return useQuery({
    queryKey: ['all-collection-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_centers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as CollectionCenter[];
    },
  });
}

// Fetch a single collection center
export function useCollectionCenter(id: string) {
  return useQuery({
    queryKey: ['collection-center', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_centers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as CollectionCenter;
    },
    enabled: !!id,
  });
}

// Create a new collection center
export function useCreateCollectionCenter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (center: Omit<CollectionCenterInsert, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('collection_centers')
        .insert(center)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-collection-centers'] });
      queryClient.invalidateQueries({ queryKey: ['collection-centers'] });
      toast({
        title: 'Center Created',
        description: 'The collection center has been successfully created.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Update a collection center
export function useUpdateCollectionCenter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: CollectionCenterUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('collection_centers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-collection-centers'] });
      queryClient.invalidateQueries({ queryKey: ['collection-centers'] });
      queryClient.invalidateQueries({ queryKey: ['collection-center', data.id] });
      toast({
        title: 'Center Updated',
        description: 'The collection center has been successfully updated.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Count linked records that block deletion
async function getCenterUsage(centerId: string) {
  const [entries, farmers, settlements] = await Promise.all([
    supabase.from('milk_entries').select('id', { count: 'exact', head: true }).eq('center_id', centerId),
    supabase.from('farmers').select('id', { count: 'exact', head: true }).eq('center_id', centerId),
    supabase.from('settlements').select('id', { count: 'exact', head: true }).eq('center_id', centerId),
  ]);

  return {
    milkEntries: entries.count ?? 0,
    farmers: farmers.count ?? 0,
    settlements: settlements.count ?? 0,
    get total() {
      return (entries.count ?? 0) + (farmers.count ?? 0) + (settlements.count ?? 0);
    },
  };
}

export function useCenterUsage(centerId?: string) {
  return useQuery({
    queryKey: ['center-usage', centerId],
    queryFn: () => getCenterUsage(centerId!),
    enabled: !!centerId,
  });
}

// Delete a collection center (only when unused)
export function useDeleteCollectionCenter() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const usage = await getCenterUsage(id);
      if (usage.total > 0) {
        const parts = [
          usage.milkEntries ? `${usage.milkEntries} milk entries` : null,
          usage.farmers ? `${usage.farmers} farmers` : null,
          usage.settlements ? `${usage.settlements} settlements` : null,
        ].filter(Boolean);
        throw new Error(
          `This center still has ${parts.join(', ')}. Deactivate it instead to preserve historical data.`
        );
      }

      // Clean up non-historical links
      await supabase.from('user_center_assignments').delete().eq('center_id', id);
      await supabase.from('pricing_settings').delete().eq('collection_center_id', id);
      await supabase.from('pricing_formula').delete().eq('collection_center_id', id);

      const { error } = await supabase.from('collection_centers').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-collection-centers'] });
      queryClient.invalidateQueries({ queryKey: ['collection-centers'] });
      toast({
        title: 'Center Deleted',
        description: 'The collection center has been permanently deleted.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Cannot Delete Center',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

// Toggle center active status
export function useToggleCenterStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('collection_centers')
        .update({ is_active })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['all-collection-centers'] });
      queryClient.invalidateQueries({ queryKey: ['collection-centers'] });
      queryClient.invalidateQueries({ queryKey: ['collection-center', data.id] });
      toast({
        title: data.is_active ? 'Center Activated' : 'Center Deactivated',
        description: data.is_active
          ? 'The collection center is now active.'
          : 'The collection center has been deactivated. No new entries can be added.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
