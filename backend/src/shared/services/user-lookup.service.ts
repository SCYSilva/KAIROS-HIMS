// backend/src/shared/services/user-lookup.service.ts

import prisma from '../prisma/prisma';

const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true,
};

/**
 * Find all users with a specific role
 * Used by incident module (assign investigator/action-owner dropdowns)
 */
export const getUsersByRole = async (role: string) => {
  return await prisma.user.findMany({
    where: { role },
    select: USER_SAFE_SELECT,
    orderBy: { name: 'asc' },
  });
};

/**
 * Find a single user by ID
 */
export const getUserById = async (userId: number) => {
  return await prisma.user.findUnique({
    where: { id: userId },
  });
};