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
  // Wizard 단계 관리
  currentStep: number;
  maxStep: number;
  stepValidation: Record<number, boolean>;
  setConfig: (config: ScheduleConfig) => void;
  setClasses: (classes: ClassInfo[]) => void;
  setSubjects: (subjects: Subject[]) => void;
  setTeachers: (teachers: Teacher[]) => void;
  setResult: (result: ScheduleResult | null) => void;
  setMultipleResults: (results: MultipleScheduleResult | null) => void;
  setSelectedResultIndex: (index: number | null) => void;
  setLoading: (loading: boolean) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  validateStep: (step: number) => boolean;
  setStepValidation: (step: number, isValid: boolean) => void;
  reset: () => void;
}

export const useTimetableStore = create<TimetableStore>()((set, get) => ({
  config: null,
  classes: [],
  subjects: [],
  teachers: [],
  result: null,
  multipleResults: null,
  selectedResultIndex: null,
  isLoading: false,
  currentStep: 1,
  maxStep: 7,
  stepValidation: {},
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
    const state = get();
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
  setCurrentStep: (step) => {
    const state = get();
    if (step >= 1 && step <= state.maxStep) {
      set({ currentStep: step });
    }
  },
  nextStep: () => {
    const state = get();
    if (state.currentStep < state.maxStep) {
      const isValid = state.validateStep(state.currentStep);
      if (isValid) {
        set({ currentStep: state.currentStep + 1 });
      }
    }
  },
  prevStep: () => {
    const state = get();
    if (state.currentStep > 1) {
      set({ currentStep: state.currentStep - 1 });
    }
  },
  validateStep: (step: number) => {
    const state = get();
    switch (step) {
      case 1:
        return state.config !== null;
      case 2:
        // 총 학급 수가 0개가 아니면 유효 (일부 학년은 학급이 없을 수 있음)
        return state.classes.length > 0;
      case 3:
        return state.subjects.length > 0;
      case 4:
        return state.teachers.length > 0;
      case 5:
        return true; // 제약조건은 선택사항
      case 6:
        return true; // 확인 단계는 항상 통과
      case 7:
        return true; // 생성 단계는 항상 통과
      default:
        return false;
    }
  },
  setStepValidation: (step, isValid) => {
    const state = get();
    set({
      stepValidation: {
        ...state.stepValidation,
        [step]: isValid
      }
    });
  },
  reset: () => set({
    config: null,
    classes: [],
    subjects: [],
    teachers: [],
    result: null,
    multipleResults: null,
    selectedResultIndex: null,
    isLoading: false,
    currentStep: 1,
    stepValidation: {}
  })
}));

