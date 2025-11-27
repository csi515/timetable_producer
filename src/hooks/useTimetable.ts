import { useCallback } from 'react';
import { useTimetableStore } from '../store/timetableStore';
import { Scheduler } from '../core/scheduler';
import { ClassInfo } from '../types/timetable';
import { useAdSense } from './useAdSense';

export const useTimetable = () => {
  const config = useTimetableStore((state) => state.config);
  const classes = useTimetableStore((state) => state.classes);
  const subjects = useTimetableStore((state) => state.subjects);
  const teachers = useTimetableStore((state) => state.teachers);
  const setResult = useTimetableStore((state) => state.setResult);
  const setMultipleResults = useTimetableStore((state) => state.setMultipleResults);
  const setLoading = useTimetableStore((state) => state.setLoading);
  const setClasses = useTimetableStore((state) => state.setClasses);
  const { showInterstitial } = useAdSense();

  const generateClasses = useCallback(() => {
    if (!config) return;

    const newClasses: ClassInfo[] = [];
    for (let i = 1; i <= config.numberOfClasses; i++) {
      newClasses.push({
        id: `${config.grade}학년-${i}반`,
        grade: config.grade,
        classNumber: i,
        name: `${config.grade}학년 ${i}반`
      });
    }
    setClasses(newClasses);
  }, [config, setClasses]);

  const generate = useCallback(async () => {
    if (!config || classes.length === 0 || subjects.length === 0 || teachers.length === 0) {
      alert('설정, 학급, 과목, 교사 정보를 모두 입력해주세요.');
      return;
    }

    // 광고 표시
    await showInterstitial();

    setLoading(true);

    try {
      // 비동기로 시간표 생성 (실제로는 Web Worker 사용 권장)
      setTimeout(() => {
        const scheduler = new Scheduler(config, subjects, teachers, classes);
        const result = scheduler.generateWithRetry(10);
        setResult(result);
        setLoading(false);
      }, 100);
    } catch (error) {
      console.error('시간표 생성 실패:', error);
      setLoading(false);
      alert('시간표 생성에 실패했습니다.');
    }
  }, [config, classes, subjects, teachers, setResult, setLoading, showInterstitial]);

  const generateMultiple = useCallback(async (minCount: number = 3) => {
    if (!config || classes.length === 0 || subjects.length === 0 || teachers.length === 0) {
      alert('설정, 학급, 과목, 교사 정보를 모두 입력해주세요.');
      return;
    }

    // 광고 표시
    await showInterstitial();

    setLoading(true);

    try {
      // 비동기로 다중 시간표 생성
      setTimeout(() => {
        const scheduler = new Scheduler(config, subjects, teachers, classes);
        const multipleResults = scheduler.generateMultiple(minCount, 50);
        
        if (multipleResults.results.length === 0) {
          alert('제약조건이 너무 엄격하여 시간표 생성이 불가능합니다.\n제약조건을 완화해주세요.');
          setLoading(false);
          return;
        }

        setMultipleResults(multipleResults);
        
        // 첫 번째 결과를 기본 선택
        if (multipleResults.results.length > 0) {
          setResult(multipleResults.results[0]);
        }
        
        setLoading(false);
      }, 100);
    } catch (error) {
      console.error('시간표 생성 실패:', error);
      setLoading(false);
      alert('시간표 생성에 실패했습니다.');
    }
  }, [config, classes, subjects, teachers, setMultipleResults, setResult, setLoading, showInterstitial]);

  return {
    generate,
    generateMultiple,
    generateClasses
  };
};

