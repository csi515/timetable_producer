import { create } from 'zustand';
import { ScheduleConfig, ClassInfo, ScheduleResult, MultipleScheduleResult } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';

interface TimetableStore {
  config: ScheduleConfig | null;
  classes: ClassInfo[];
  subjects: Subject[];
  teachers: Teacher[];
  result: ScheduleResult | null;
  multipleResults: MultipleScheduleResult | null;
  selectedResultIndex: number | null;
  isLoading: boolean;
  setConfig: (config: ScheduleConfig) => void;
  setClasses: (classes: ClassInfo[]) => void;
  setSubjects: (subjects: Subject[]) => void;
  setTeachers: (teachers: Teacher[]) => void;
  setResult: (result: ScheduleResult | null) => void;
  setMultipleResults: (results: MultipleScheduleResult | null) => void;
  setSelectedResultIndex: (index: number | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useTimetableStore = create<TimetableStore>()((set) => ({
  config: null,
  classes: [],
  subjects: [],
  teachers: [],
  result: null,
  multipleResults: null,
  selectedResultIndex: null,
  isLoading: false,
  setConfig: (config) => set({ config }),
  setClasses: (classes) => set({ classes }),
  setSubjects: (subjects) => set({ subjects }),
  setTeachers: (teachers) => set({ teachers }),
  setResult: (result) => set({ result }),
  setMultipleResults: (multipleResults) => set({ 
    multipleResults,
    selectedResultIndex: multipleResults?.selectedIndex ?? null
  }),
  setSelectedResultIndex: (selectedResultIndex) => {
    const state = useTimetableStore.getState();
    const multipleResults = state.multipleResults;
    let newResult = null;
    
    if (multipleResults && selectedResultIndex !== null && multipleResults.results[selectedResultIndex]) {
      newResult = multipleResults.results[selectedResultIndex];
    }
    
    set({ 
      selectedResultIndex,
      result: newResult
    });
  },
  setLoading: (isLoading) => set({ isLoading }),
  reset: () => set({
    config: null,
    classes: [],
    subjects: [],
    teachers: [],
    result: null,
    multipleResults: null,
    selectedResultIndex: null,
    isLoading: false
  })
}));

