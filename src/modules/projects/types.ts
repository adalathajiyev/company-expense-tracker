export type ProjectStatus = 'planned' | 'active' | 'completed' | 'archived'

export interface Project {
  id: string
  name: string
  location: string
  status: ProjectStatus
  estimated_cost: number | null
  description: string | null
  created_by: string | null
  created_by_email: string
  created_at: string
  updated_at: string
  actual_cost: number
  paid_cost: number
  pending_cost: number
  expense_count: number
  variance: number | null
}

export type ProjectInput = Pick<Project, 'name' | 'location' | 'status' | 'estimated_cost' | 'description'>

export type ProjectOption = Pick<Project, 'id' | 'name' | 'location' | 'status'>
