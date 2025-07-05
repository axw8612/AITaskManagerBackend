export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId?: string;
  projectId?: string;
  createdBy: string;
  dueDate?: Date;
  completedAt?: Date;
  tags: string[];
  attachments: TaskAttachment[];
  aiSuggestions?: AISuggestion[];
  estimatedHours?: number;
  actualHours?: number;
  createdAt: Date;
  updatedAt: Date;
}

export enum TaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export interface TaskAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface AISuggestion {
  id: string;
  type: AISuggestionType;
  content: string;
  confidence: number;
  createdAt: Date;
  isApplied: boolean;
}

export enum AISuggestionType {
  TASK_BREAKDOWN = 'task_breakdown',
  TIME_ESTIMATE = 'time_estimate',
  PRIORITY_ADJUSTMENT = 'priority_adjustment',
  ASSIGNEE_SUGGESTION = 'assignee_suggestion',
  DEADLINE_SUGGESTION = 'deadline_suggestion',
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  assigneeId?: string;
  projectId?: string;
  dueDate?: Date;
  tags?: string[];
  estimatedHours?: number;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  dueDate?: Date;
  tags?: string[];
  estimatedHours?: number;
  actualHours?: number;
}

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  assigneeId?: string;
  projectId?: string;
  tags?: string[];
  dueDateFrom?: Date;
  dueDateTo?: Date;
  search?: string;
}

export interface TaskResponse {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  project?: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  dueDate?: Date;
  completedAt?: Date;
  tags: string[];
  attachments: TaskAttachment[];
  aiSuggestions?: AISuggestion[];
  estimatedHours?: number;
  actualHours?: number;
  createdAt: Date;
  updatedAt: Date;
}
