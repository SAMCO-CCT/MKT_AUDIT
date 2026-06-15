import { prisma } from "@/lib/prisma";

export type UserPermissionRow = {
  permission_id: string;
  user_id: string;
  company_code: string | null;
  project_code: string | null;
  access_level: string | null;
  is_active: boolean;
};

export async function hasCompanyPermission(userId: string, companyCode: string) {
  if (!userId || !companyCode) return false;

  const permission = await prisma.user_permissions.findFirst({
    where: {
      user_id: userId,
      is_active: true,
      OR: [{ company_code: null }, { company_code: companyCode }],
    },
    select: { permission_id: true },
  });

  return Boolean(permission);
}

export async function hasProjectPermission(
  userId: string,
  companyCode: string,
  projectCode: string
) {
  if (!userId || !companyCode || !projectCode) return false;

  const permission = await prisma.user_permissions.findFirst({
    where: {
      user_id: userId,
      is_active: true,
      AND: [
        { OR: [{ company_code: null }, { company_code: companyCode }] },
        { OR: [{ project_code: null }, { project_code: projectCode }] },
      ],
    },
    select: { permission_id: true },
  });

  return Boolean(permission);
}

export async function getProjectPermissionFilter(userId: string, companyCode: string) {
  const permissions = (await prisma.user_permissions.findMany({
    where: {
      user_id: userId,
      is_active: true,
      OR: [{ company_code: null }, { company_code: companyCode }],
    },
    select: {
      company_code: true,
      project_code: true,
    },
  })) as Pick<UserPermissionRow, "company_code" | "project_code">[];

  const allowAll = permissions.some((row) => row.project_code === null);
  const allowedProjectCodes = new Set(
    permissions.flatMap((row) => (row.project_code ? [row.project_code] : []))
  );

  return {
    allowAll,
    allowedProjectCodes,
  };
}

export async function canAccessProject({
  userId,
  companyCode,
  projectCode,
}: {
  userId: string;
  companyCode: string;
  projectCode: string;
}): Promise<boolean> {
  return hasProjectPermission(userId, companyCode, projectCode);
}
