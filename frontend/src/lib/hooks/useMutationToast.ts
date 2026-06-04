'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useMutationToast() {
  const qc = useQueryClient();

  return {
    onSuccess: (message: string, invalidateKeys?: QueryKey[]) => {
      toast.success(message);
      for (const key of invalidateKeys ?? []) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: (err: Error) => toast.error(err.message),
  };
}
