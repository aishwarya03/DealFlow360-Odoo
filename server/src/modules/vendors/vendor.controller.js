import { sendSuccess } from '../../utils/apiResponse.js';
import * as vendorService from './vendor.service.js';

export const list = async (req, res) => {
  const vendors = await vendorService.listVendors(req.validatedQuery);

  sendSuccess(res, 'Vendors', { vendors, count: vendors.length });
};

export const getOne = async (req, res) => {
  const vendor = await vendorService.getVendorById(req.params.id);

  sendSuccess(res, 'Vendor', { vendor });
};

export const create = async (req, res) => {
  const vendor = await vendorService.createVendor(req.body);

  sendSuccess(res, 'Vendor created', { vendor }, 201);
};

export const update = async (req, res) => {
  const vendor = await vendorService.updateVendor(req.params.id, req.body);

  sendSuccess(res, 'Vendor updated', { vendor });
};

export const deactivate = async (req, res) => {
  const vendor = await vendorService.deactivateVendor(req.params.id);

  sendSuccess(res, 'Vendor deactivated', { vendor });
};
