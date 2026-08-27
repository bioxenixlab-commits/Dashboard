import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { PaginatedResponse } from '@/lib/types'

export function useList<T>(
  endpoint: string,
  params?: Record<string, unknown>,
  options?: UseQueryOptions<PaginatedResponse<T>, Error>
) {
  return useQuery<PaginatedResponse<T>, Error>({
    queryKey: [endpoint, params],
    queryFn: async () => {
      const response = await api.get(endpoint, { params })
      return response.data
    },
    ...options,
  })
}

export function useDetail<T>(
  endpoint: string,
  id: string | number | null,
  options?: UseQueryOptions<T, Error>
) {
  return useQuery<T, Error>({
    queryKey: [endpoint, id],
    queryFn: async () => {
      const response = await api.get(`${endpoint}${id}/`)
      return response.data
    },
    enabled: !!id,
    ...options,
  })
}

export function useCreate<TData, TVariables>(
  endpoint: string,
  options?: UseMutationOptions<TData, Error, TVariables, unknown>
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, Error, TVariables, unknown>({
    mutationFn: async (data) => {
      const response = await api.post(endpoint, data as any)
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
      options?.onSuccess?.(data, variables, context as any)
    },
    ...options,
  })
}

export function useUpdate<TData, TVariables extends { id: string | number }>(
  endpoint: string,
  options?: UseMutationOptions<TData, Error, TVariables, unknown>
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, Error, TVariables, unknown>({
    mutationFn: async (variables) => {
      const { id, ...data } = variables as any
      const response = await api.patch(`${endpoint}${id}/`, data)
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
      options?.onSuccess?.(data, variables, context as any)
    },
    ...options,
  })
}

export function useDelete<TData>(
  endpoint: string,
  options?: UseMutationOptions<TData, Error, string | number, unknown>
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, Error, string | number, unknown>({
    mutationFn: async (id) => {
      const response = await api.delete(`${endpoint}${id}/`)
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [endpoint] })
      options?.onSuccess?.(data, variables, context as any)
    },
    ...options,
  })
}

export function useCustomMutation<TData, TVariables>(
  endpoint: string,
  method: 'post' | 'put' | 'patch' | 'delete' = 'post',
  options?: UseMutationOptions<TData, Error, TVariables, unknown>
) {
  const queryClient = useQueryClient()
  
  return useMutation<TData, Error, TVariables, unknown>({
    mutationFn: async (data) => {
      const response = await (api as any)[method](endpoint, data)
      return response.data
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: [endpoint.split('/')[0]] })
      options?.onSuccess?.(data, variables, context as any)
    },
    ...options,
  })
}