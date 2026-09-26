import type { RequestHandler } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/auth.js';
import * as service from '../services/equipmentTypeService.js';

const createSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  inspectionFrequencyDays: z.number().int().min(1).max(3650).optional(),
  isActive: z.boolean().optional(),
});

const updateSchema = createSchema.partial();

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const includeInactive = req.query.includeInactive === 'true';
  const items = await service.listEquipmentTypes({ includeInactive });
  res.json({ equipmentTypes: items });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const item = await service.getEquipmentType(req.params.id);
  res.json({ equipmentType: item });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = createSchema.parse(req.body);
  const item = await service.createEquipmentType(parsed);
  res.status(201).json({ equipmentType: item });
});

export const update: RequestHandler = asyncHandler(async (req, res) => {
  const parsed = updateSchema.parse(req.body);
  const item = await service.updateEquipmentType(req.params.id, parsed);
  res.json({ equipmentType: item });
});
