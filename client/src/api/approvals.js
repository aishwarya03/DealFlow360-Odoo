import apiClient from './client';

export const listApprovalRequests = async (params = {}) => {
  const res = await apiClient.get('/api/internal/approvals', { params });
  return res.data.data.approvalRequests;
};

export const actOnStep = async (approvalRequestId, stepId, data) => {
  const res = await apiClient.post(
    `/api/internal/approvals/${approvalRequestId}/steps/${stepId}/act`,
    data
  );
  return res.data.data.approvalRequest;
};
