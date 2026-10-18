// backend/src/shared/services/department.service.ts

import prisma from '../prisma/prisma';

/**
 * Fetch the list of all departments
 * Shared service — used by staff config, incident creation, admin, etc.
 */
export const getAllDepartments = async () => {
  return await prisma.department.findMany({
    orderBy: { id: 'asc' },
  });
};