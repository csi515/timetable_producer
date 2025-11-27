import { ScheduleConfig, ClassInfo } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import { ScheduleResult } from '../types/timetable';

const DB_NAME = 'TimetableDB';
const DB_VERSION = 1;
const STORE_CONFIG = 'config';
const STORE_CLASSES = 'classes';
const STORE_SUBJECTS = 'subjects';
const STORE_TEACHERS = 'teachers';
const STORE_RESULT = 'result';

let db: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
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

      if (!database.objectStoreNames.contains(STORE_CONFIG)) {
        database.createObjectStore(STORE_CONFIG);
      }
      if (!database.objectStoreNames.contains(STORE_CLASSES)) {
        database.createObjectStore(STORE_CLASSES, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_SUBJECTS)) {
        database.createObjectStore(STORE_SUBJECTS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_TEACHERS)) {
        database.createObjectStore(STORE_TEACHERS, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(STORE_RESULT)) {
        database.createObjectStore(STORE_RESULT);
      }
    };
  });
};

export const saveConfig = async (config: ScheduleConfig): Promise<void> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_CONFIG], 'readwrite');
  const store = transaction.objectStore(STORE_CONFIG);
  store.put(config, 'current');
};

export const loadConfig = async (): Promise<ScheduleConfig | null> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_CONFIG], 'readonly');
  const store = transaction.objectStore(STORE_CONFIG);
  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

export const saveClasses = async (classes: ClassInfo[]): Promise<void> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_CLASSES], 'readwrite');
  const store = transaction.objectStore(STORE_CLASSES);
  
  // 기존 데이터 삭제
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  // 새 데이터 저장
  for (const classInfo of classes) {
    store.add(classInfo);
  }
};

export const loadClasses = async (): Promise<ClassInfo[]> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_CLASSES], 'readonly');
  const store = transaction.objectStore(STORE_CLASSES);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveSubjects = async (subjects: Subject[]): Promise<void> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_SUBJECTS], 'readwrite');
  const store = transaction.objectStore(STORE_SUBJECTS);
  
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  for (const subject of subjects) {
    store.add(subject);
  }
};

export const loadSubjects = async (): Promise<Subject[]> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_SUBJECTS], 'readonly');
  const store = transaction.objectStore(STORE_SUBJECTS);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveTeachers = async (teachers: Teacher[]): Promise<void> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_TEACHERS], 'readwrite');
  const store = transaction.objectStore(STORE_TEACHERS);
  
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear();
    clearRequest.onsuccess = () => resolve();
    clearRequest.onerror = () => reject(clearRequest.error);
  });

  for (const teacher of teachers) {
    store.add(teacher);
  }
};

export const loadTeachers = async (): Promise<Teacher[]> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_TEACHERS], 'readonly');
  const store = transaction.objectStore(STORE_TEACHERS);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const saveResult = async (result: ScheduleResult): Promise<void> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_RESULT], 'readwrite');
  const store = transaction.objectStore(STORE_RESULT);
  store.put(result, 'current');
};

export const loadResult = async (): Promise<ScheduleResult | null> => {
  const database = await initDB();
  const transaction = database.transaction([STORE_RESULT], 'readonly');
  const store = transaction.objectStore(STORE_RESULT);
  return new Promise((resolve, reject) => {
    const request = store.get('current');
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
};

