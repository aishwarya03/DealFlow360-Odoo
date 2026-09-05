import { sendSuccess, sendError } from '../../utils/apiResponse.js';

import * as approvalService from './approval.service.js';

const ACT_MESSAGE = {
  APPROVE: 'Step approved',
  REJECT: 'Step rejected',
  RETURN: 'Step returned for rework',
};

export const list = async (req, res) => {
  try {
    const requests = await approvalService.listApprovalRequests(
      req.validatedQuery,
      req.user
    );

    sendSuccess(res, 'Approval requests', {
      approvalRequests: requests,
      count: requests.length,
    });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const getOne = async (req, res) => {
  try {
    const request = await approvalService.getApprovalRequestById(
      req.params.id
    );

    sendSuccess(res, 'Approval request', {
      approvalRequest: request,
    });
  } catch (error) {
    sendError(res, error.message);
  }
};

export const act = async (req, res) => {
  try {
    const request = await approvalService.actOnStep(
      req.params.id,
      req.params.stepId,
      req.body,
      req.user
    );

    sendSuccess(
      res,
      ACT_MESSAGE[req.body.action],
      { approvalRequest: request }
    );
  } catch (error) {
    sendError(res, error.message);
  }
};
