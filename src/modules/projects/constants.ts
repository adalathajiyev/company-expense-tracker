import type { ProjectInput, ProjectStatus } from './types'

export const projectStatuses: ProjectStatus[] = ['planned', 'active', 'completed', 'archived']

export const projectStatusLabels: Record<ProjectStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived',
}

export function createEmptyProject(): ProjectInput {
  return {
    name: '',
    location: '',
    status: 'planned',
    estimated_cost: null,
    description: null,
  }
}
