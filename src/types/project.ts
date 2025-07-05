export interface Project {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  color?: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectStatus {
  PLANNING = 'planning',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
}

export enum ProjectRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
  VIEWER = 'viewer',
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  color?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  owner: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  status: ProjectStatus;
  startDate?: Date;
  endDate?: Date;
  budget?: number;
  color?: string;
  isArchived: boolean;
  members: ProjectMemberResponse[];
  taskCount: number;
  completedTaskCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMemberResponse {
  id: string;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  role: ProjectRole;
  joinedAt: Date;
}

export interface AddProjectMemberInput {
  userId: string;
  role: ProjectRole;
}
