import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type Profile = Database['public']['Tables']['profiles']['Row']

/** Only these columns are updatable by the client (column grants in the profiles migration). */
export type ProfileUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'display_name' | 'state' | 'school_type' | 'grade' | 'privacy_version'
>

const profileKey = (userId: string | undefined) => ['profile', userId] as const

export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: profileKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId!).single()
      if (error) throw error
      return data
    },
  })
}

export function useUpdateProfile() {
  const { session } = useAuth()
  const userId = session?.user.id
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (update: ProfileUpdate) => {
      if (!userId) throw new Error('not signed in')
      const { data, error } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', userId)
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (profile) => queryClient.setQueryData(profileKey(userId), profile),
  })
}
