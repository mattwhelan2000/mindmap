export type NodeData = {
  id: string;
  text: string;
  image?: string; // base64 string
  children: NodeData[];
};

export type ProjectData = {
  id: string;
  name: string;
  updatedAt: number;
  rootNode: NodeData;
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

  static createEmptyProject(name: string): ProjectData {
    return {
      id: crypto.randomUUID(),
      name,
      updatedAt: Date.now(),
      rootNode: {
        id: crypto.randomUUID(),
        text: 'Root Node',
        children: []
      }
    };
  }
}
