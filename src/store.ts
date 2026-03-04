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
  backgroundColor?: string;
  icon?: string;
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
  layoutDirection?: 'horizontal' | 'vertical';
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
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(projects));
    } catch (e: any) {
      if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
        alert('MindMap Save Error: You have reached the storage limit for this browser. Please export your project to a ZIP file to back it up, or remove some large images. Recent changes may not be saved.');
      } else {
        alert('Failed to save project: ' + e.message);
      }
    }
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

export const updateNode = (node: NodeData, id: string, text: string, image?: string, width?: number, url?: string, backgroundColor?: string, icon?: string): NodeData => {
  if (node.id === id) {
    return {
      ...node,
      text,
      ...(image !== undefined ? { image } : {}),
      ...(width !== undefined ? { width } : {}),
      ...(url !== undefined ? { url } : {}),
      ...(backgroundColor !== undefined ? { backgroundColor } : {}),
      ...(icon !== undefined ? { icon } : {})
    };
  };
  return node; // Return original node if ID doesn't match
};
