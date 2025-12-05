import { Project, ProjectTab } from '../types';

const DB_NAME = 'RealDataDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
const CONFIG_KEY = 'real_data_config_v1';

// Open Database Connection
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => reject("IndexedDB error");

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event: any) => {
      resolve(event.target.result);
    };
  });
};

// --- Async CRUD Operations ---

export const getProjects = async (): Promise<Project[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveProject = async (project: Project): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    // Ensure lastModified is updated
    // transformRules and other new fields will be saved automatically as long as they are part of the object
    const updatedProject = { ...project, lastModified: Date.now() };
    
    const request = store.put(updatedProject);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// --- Sync LocalStorage for UI Config Only ---

export const saveLastState = (projectId: string, tab: ProjectTab) => {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ projectId, tab }));
};

export const getLastState = (): { projectId: string | null, tab: ProjectTab } => {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return { projectId: null, tab: ProjectTab.UPLOAD };
};