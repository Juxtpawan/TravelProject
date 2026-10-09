import { apiClient } from '../../../lib/apiClient';

export async function upgradeMembership(userId, tier) {
  const { data } = await apiClient.post('/subscriptions/upgrade', { userId, tier });
  return data;
}