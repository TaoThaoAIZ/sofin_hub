import { apiPost } from '../../lib/api';

export const subscribeNewsletter = (email: string) =>
  apiPost<{ data: { subscribed: boolean } }>('/newsletter', { email }, { skipAuthRetry: true }).then((r) => r.data);

export interface ContactInput {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const sendContact = (input: ContactInput) =>
  apiPost<{ data: { message: string } }>('/contact', input, { skipAuthRetry: true }).then((r) => r.data);
