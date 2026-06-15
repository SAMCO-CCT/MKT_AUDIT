export type ExternalProject = {
  Company: string;
  CompanyName: string;
  Project: string;
  ProjectName: string;
  IsHousingJuristicPerson: boolean;
};

export function isAuditProject(project: ExternalProject) {
  return project.IsHousingJuristicPerson === false;
}

export function getUniqueAuditProjects(projects: ExternalProject[]) {
  const projectMap = new Map<string, ExternalProject>();

  for (const project of projects) {
    if (!isAuditProject(project)) continue;

    const key = `${project.Company}\u0000${project.Project}`;
    if (!projectMap.has(key)) {
      projectMap.set(key, project);
    }
  }

  return Array.from(projectMap.values());
}
