import { Template, TemplateType } from '../types/template';

const DB_NAME = 'TimetableDB';
const DB_VERSION = 2; // 버전 업그레이드
const STORE_TEMPLATES = 'templates';

let db: IDBDatabase | null = null;

export const initTemplateDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = (event.target as IDBOpenDBRequest).result;
            const oldVersion = event.oldVersion;

            // 기존 스토어들은 유지 (storage.ts에서 관리)
            if (!database.objectStoreNames.contains('config')) {
                database.createObjectStore('config');
            }
            if (!database.objectStoreNames.contains('classes')) {
                database.createObjectStore('classes', { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains('subjects')) {
                database.createObjectStore('subjects', { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains('teachers')) {
                database.createObjectStore('teachers', { keyPath: 'id' });
            }
            if (!database.objectStoreNames.contains('result')) {
                database.createObjectStore('result');
            }

            // 새로운 템플릿 스토어 추가
            if (!database.objectStoreNames.contains(STORE_TEMPLATES)) {
                const templateStore = database.createObjectStore(STORE_TEMPLATES, { keyPath: 'id' });
                templateStore.createIndex('type', 'type', { unique: false });
                templateStore.createIndex('createdAt', 'createdAt', { unique: false });
            }
        };
    });
};

export const saveTemplate = async (template: Template): Promise<void> => {
    const database = await initTemplateDB();
    const transaction = database.transaction([STORE_TEMPLATES], 'readwrite');
    const store = transaction.objectStore(STORE_TEMPLATES);

    return new Promise((resolve, reject) => {
        const request = store.put(template);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const loadTemplate = async (id: string): Promise<Template | null> => {
    const database = await initTemplateDB();
    const transaction = database.transaction([STORE_TEMPLATES], 'readonly');
    const store = transaction.objectStore(STORE_TEMPLATES);

    return new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const loadAllTemplates = async (): Promise<Template[]> => {
    const database = await initTemplateDB();
    const transaction = database.transaction([STORE_TEMPLATES], 'readonly');
    const store = transaction.objectStore(STORE_TEMPLATES);

    return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const templates = request.result || [];
            // 최신순으로 정렬
            templates.sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            resolve(templates);
        };
        request.onerror = () => reject(request.error);
    });
};

export const loadTemplatesByType = async (type: TemplateType): Promise<Template[]> => {
    const database = await initTemplateDB();
    const transaction = database.transaction([STORE_TEMPLATES], 'readonly');
    const store = transaction.objectStore(STORE_TEMPLATES);
    const index = store.index('type');

    return new Promise((resolve, reject) => {
        const request = index.getAll(type);
        request.onsuccess = () => {
            const templates = request.result || [];
            templates.sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );
            resolve(templates);
        };
        request.onerror = () => reject(request.error);
    });
};

export const deleteTemplate = async (id: string): Promise<void> => {
    const database = await initTemplateDB();
    const transaction = database.transaction([STORE_TEMPLATES], 'readwrite');
    const store = transaction.objectStore(STORE_TEMPLATES);

    return new Promise((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};

export const updateTemplate = async (id: string, updates: Partial<Template>): Promise<void> => {
    const template = await loadTemplate(id);

    if (!template) {
        throw new Error('Template not found');
    }

    const updatedTemplate: Template = {
        ...template,
        ...updates,
        updatedAt: new Date()
    };

    await saveTemplate(updatedTemplate);
};
