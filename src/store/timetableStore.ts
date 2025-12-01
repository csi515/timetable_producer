import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { wrap } from 'comlink';
import { ScheduleConfig, ClassInfo, ScheduleResult, MultipleScheduleResult, TimetableEntry } from '../types/timetable';
import { Subject } from '../types/subject';
import { Teacher } from '../types/teacher';
import type { SchedulerWorker } from '../core/worker';

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
  generateSchedule: (minCount?: number, maxAttempts?: number) => Promise<void>;
  updateEntry: (entry: TimetableEntry) => void;
  swapEntries: (entryAId: string, entryBId: string) => void;
}

export const useTimetableStore = create<TimetableStore>()(
  persist(
    (set, get) => ({
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
            return state.classes.length > 0;
          case 3:
            return state.subjects.length > 0;
          case 4:
            return state.teachers.length > 0;
          case 5:
            return true;
          case 6:
            return true;
          case 7:
            return true;
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
      }),
      generateSchedule: async (minCount: number = 3, maxAttempts: number = 50) => {
        const state = get();
        if (!state.config) return;

        set({ isLoading: true });

        try {
          const worker = new Worker(new URL('../core/worker.ts', import.meta.url), {
            type: 'module'
          });

          const workerApi = wrap<SchedulerWorker>(worker);

          // 생성 시도
          const result = await workerApi.runSchedulerMultiple(
            state.config,
            state.subjects,
            state.teachers,
            state.classes,
            minCount,
            maxAttempts
          );

          set({
            multipleResults: result,
            selectedResultIndex: result.selectedIndex ?? null,
            result: result.results[0] || null,
            isLoading: false
          });

          // 워커 종료는 필요에 따라 처리 (여기서는 일회용으로 사용하고 GC에 맡기거나 명시적 terminate 가능)
          // worker.terminate(); // comlink wrap된 경우 직접 terminate하기 까다로울 수 있음.
          // 하지만 wrap된 객체에는 terminate가 없음. worker 인스턴스를 terminate 해야 함.
          // 비동기 완료 후 terminate
          // worker.terminate(); 
        } catch (error) {
          console.error('Schedule generation failed:', error);
          set({ isLoading: false });
        }
      },
      updateEntry: (updatedEntry) => {
        const state = get();
        if (!state.result) return;

        const newEntries = state.result.entries.map(e =>
          e.id === updatedEntry.id ? updatedEntry : e
        );

        const newResult = { ...state.result, entries: newEntries };

        // Update multipleResults as well
        let newMultipleResults = state.multipleResults;
        if (state.multipleResults && state.selectedResultIndex !== null) {
          const newResults = [...state.multipleResults.results];
          newResults[state.selectedResultIndex] = newResult;
          newMultipleResults = { ...state.multipleResults, results: newResults };
        }

        set({
          result: newResult,
          multipleResults: newMultipleResults
        });
      },
      swapEntries: (entryAId, entryBId) => {
        const state = get();
        if (!state.result) return;

        const entryA = state.result.entries.find(e => e.id === entryAId);
        const entryB = state.result.entries.find(e => e.id === entryBId);

        if (!entryA || !entryB) return;

        // Swap day and period
        const newEntryA = { ...entryA, day: entryB.day, period: entryB.period };
        const newEntryB = { ...entryB, day: entryA.day, period: entryA.period };

        const newEntries = state.result.entries.map(e => {
          if (e.id === entryAId) return newEntryA;
          if (e.id === entryBId) return newEntryB;
          return e;
        });

        const newResult = { ...state.result, entries: newEntries };

        // Update multipleResults as well
        let newMultipleResults = state.multipleResults;
        if (state.multipleResults && state.selectedResultIndex !== null) {
          const newResults = [...state.multipleResults.results];
          newResults[state.selectedResultIndex] = newResult;
          newMultipleResults = { ...state.multipleResults, results: newResults };
        }

        set({
          result: newResult,
          multipleResults: newMultipleResults
        });
      }
    }),
    {
      name: 'timetable-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        config: state.config,
        classes: state.classes,
        subjects: state.subjects,
        teachers: state.teachers,
        // 결과는 제외 (너무 클 수 있음)
      }),
    }
  )
);

