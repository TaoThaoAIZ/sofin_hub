import i18n, { currentLocale } from '../../i18n';
import type { MemberRole, PointReason } from './types';

export const roleLabel = (role: MemberRole): string => i18n.t(`roles.${role}`, { ns: 'account', defaultValue: role });

export const reasonLabel = (reason: PointReason): string => i18n.t(`reasons.${reason}`, { ns: 'account', defaultValue: reason });

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString(currentLocale());
