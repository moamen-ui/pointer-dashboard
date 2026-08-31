// TEMPORARY local stand-in for the generated `environments` module.
//
// The API's AppEnvironments tag is already listed in poitner-api's orval.config.ts
// filters.tags, but the live Swagger spec (which the Publish API clients workflow
// generates from) does not carry the endpoints yet, so no published
// @moamen-ui/pointer-react version exports them. This module mirrors the generated
// module's exact surface — hook names, `.mutate({ data } | { id, data })` call
// shape, query key, and Result<T> unwrapping over the package's own AXIOS_INSTANCE
// transport (configured in src/lib/api.ts) — so when the client publish lands,
// deleting this file and flipping the page's import to '@moamen-ui/pointer-react'
// is a one-line change.
import {
  useMutation,
  useQuery,
  type UseMutationOptions,
} from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import { AXIOS_INSTANCE } from '@moamen-ui/pointer-react';

export interface AppEnvironmentResponse {
  id?: number;
  name?: string | null;
  /** Super-admin-seeded global environments ("default", "prod", ...) are read-only. */
  isGlobal?: boolean;
  /** Computed by the API: false for global catalog entries — hides row actions. */
  canManage?: boolean;
}

export interface CreateEnvironmentRequest {
  name?: string | null;
}

export interface UpdateEnvironmentRequest {
  name?: string | null;
}

interface ResultEnvelope<T> {
  isSuccess?: boolean;
  message?: string | null;
  data: T;
}

// Same unwrapping the package's own customInstance performs: resolve to the inner
// payload, throw the API's message on failure.
async function customInstance<T>(config: AxiosRequestConfig): Promise<T> {
  const response = await AXIOS_INSTANCE.request<ResultEnvelope<T>>(config);
  const body = response.data;
  if (!body?.isSuccess) throw new Error(body?.message || 'Request failed');
  return body.data;
}

export const getGetApiAdminEnvironmentsQueryKey = () =>
  ['/api/admin/environments'] as const;

export function useGetApiAdminEnvironments() {
  return useQuery({
    queryKey: getGetApiAdminEnvironmentsQueryKey(),
    queryFn: ({ signal }) =>
      customInstance<AppEnvironmentResponse[]>({
        url: '/api/admin/environments',
        method: 'GET',
        signal,
      }),
  });
}

export function usePostApiAdminEnvironments(
  options?: {
    mutation?: UseMutationOptions<
      AppEnvironmentResponse,
      Error,
      { data: CreateEnvironmentRequest }
    >;
  },
) {
  return useMutation({
    mutationFn: ({ data }) =>
      customInstance<AppEnvironmentResponse>({
        url: '/api/admin/environments',
        method: 'POST',
        data,
      }),
    ...options?.mutation,
  });
}

export function usePatchApiAdminEnvironmentsId(
  options?: {
    mutation?: UseMutationOptions<
      AppEnvironmentResponse,
      Error,
      { id: number; data: UpdateEnvironmentRequest }
    >;
  },
) {
  return useMutation({
    mutationFn: ({ id, data }) =>
      customInstance<AppEnvironmentResponse>({
        url: `/api/admin/environments/${id}`,
        method: 'PATCH',
        data,
      }),
    ...options?.mutation,
  });
}

export function useDeleteApiAdminEnvironmentsId(
  options?: {
    mutation?: UseMutationOptions<void, Error, { id: number }>;
  },
) {
  return useMutation({
    mutationFn: ({ id }) =>
      customInstance<void>({
        url: `/api/admin/environments/${id}`,
        method: 'DELETE',
      }),
    ...options?.mutation,
  });
}
