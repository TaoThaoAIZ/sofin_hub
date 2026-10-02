import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthContext';
import { courseKeys } from '../courses/queries';
import * as api from './api';
import type { DraftStepName } from './types';

export const wizardKeys = {
  drafts: ['wizard', 'drafts'] as const,
  draft: (id: string) => ['wizard', 'draft', id] as const,
  ownerPlans: ['wizard', 'owner-plans'] as const,
  rules: ['wizard', 'rules-template'] as const,
  estimate: (price: number, interval: string) => ['wizard', 'estimate', price, interval] as const,
  checklist: (id: string) => ['wizard', 'checklist', id] as const,
};

export const useOwnerPlans = () => useQuery({ queryKey: wizardKeys.ownerPlans, queryFn: ({ signal }) => api.fetchOwnerPlans(signal), staleTime: 5 * 60_000 });
export const useRulesTemplate = () => useQuery({ queryKey: wizardKeys.rules, queryFn: ({ signal }) => api.fetchRulesTemplate(signal), staleTime: 30 * 60_000 });

export const useMyDrafts = () => {
  const { status } = useAuth();
  return useQuery({ queryKey: wizardKeys.drafts, queryFn: ({ signal }) => api.listDrafts(signal), enabled: status === 'authenticated' });
};

export const useDraft = (id: string | null) =>
  useQuery({ queryKey: wizardKeys.draft(id ?? ''), queryFn: ({ signal }) => api.getDraft(id!, signal), enabled: !!id, retry: false, staleTime: Infinity });

export const useRevenueEstimate = (price: number, interval: 'monthly' | 'annual', enabled: boolean) =>
  useQuery({
    queryKey: wizardKeys.estimate(price, interval),
    queryFn: ({ signal }) => api.fetchRevenueEstimate(price, interval, signal),
    enabled: enabled && price > 0,
    staleTime: 60_000,
  });

export const useLaunchChecklist = (id: string, enabled: boolean) =>
  useQuery({ queryKey: wizardKeys.checklist(id), queryFn: ({ signal }) => api.fetchLaunchChecklist(id, signal), enabled });

export const useCreateDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createDraft,
    onSuccess: (d) => {
      qc.setQueryData(wizardKeys.draft(d.id), d);
      void qc.invalidateQueries({ queryKey: wizardKeys.drafts });
    },
  });
};

export const usePatchDraftStep = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, step, body }: { id: string; step: DraftStepName; body: unknown }) =>
      api.patchDraftStep(id, step, body as never),
    onSuccess: (d, v) => {
      // Đổi slug ở bước 1 = đổi id → bỏ cache id cũ.
      if (d.id !== v.id) qc.removeQueries({ queryKey: wizardKeys.draft(v.id) });
      qc.setQueryData(wizardKeys.draft(d.id), d);
      void qc.invalidateQueries({ queryKey: wizardKeys.drafts });
    },
  });
};

export const useDeleteDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteDraft,
    onSuccess: () => void qc.invalidateQueries({ queryKey: wizardKeys.drafts }),
  });
};

export const usePublishDraft = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.publishDraft,
    onSuccess: (c, id) => {
      qc.removeQueries({ queryKey: wizardKeys.draft(id) });
      void qc.invalidateQueries({ queryKey: wizardKeys.drafts });
      void qc.invalidateQueries({ queryKey: [...courseKeys.all, 'list'] });
      void qc.invalidateQueries({ queryKey: courseKeys.categories });
      void qc.invalidateQueries({ queryKey: courseKeys.detail(c.id) });
    },
  });
};

export const usePayoutAccount = () => {
  const qc = useQueryClient();
  const refresh = (id: string) => void qc.invalidateQueries({ queryKey: wizardKeys.draft(id) });
  return {
    connect: useMutation({
      mutationFn: ({ id, ...body }: { id: string; bankName: string; accountHolder: string; accountNumber: string }) => api.putPayoutAccount(id, body),
      onSuccess: (_r, v) => refresh(v.id),
    }),
    skip: useMutation({ mutationFn: (id: string) => api.skipPayoutAccount(id), onSuccess: (_r, id) => refresh(id) }),
  };
};
