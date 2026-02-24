export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 12);
};

export type NodeData = {
  id: string;
  text: string;
  image?: string; // base64 string
  url?: string; // hyperlink url
  isCollapsed?: boolean;
  width?: number; // Added to persist manual scaling
  children: NodeData[];
};

export type ProjectData = {
  id: string;
  name: string;
  updatedAt: number;
  rootNode: NodeData;
  thumbnail?: string;
  canvasPosition?: { x: number, y: number };
  canvasScale?: number;
  backgroundColor?: string;
};

export class Store {
  private static STORAGE_KEY = 'mindmap_projects';

  static getProjects(): ProjectData[] {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  static saveProject(project: ProjectData) {
    const projects = this.getProjects();
    const existingIndex = projects.findIndex(p => p.id === project.id);
    if (existingIndex >= 0) {
      projects[existingIndex] = project;
    } else {
      projects.push(project);
    }
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
  }

  static deleteProject(id: string) {
    const projects = this.getProjects().filter(p => p.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
  }

  static createEmptyProject(name: string, backgroundColor: string = '#242424'): ProjectData {
    return {
      id: generateId(),
      name,
      updatedAt: Date.now(),
      backgroundColor,
      rootNode: {
        id: generateId(),
        text: 'Root Node',
        children: []
      }
    };
  }
}
