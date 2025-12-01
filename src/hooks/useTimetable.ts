import { useCallback } from 'react';
import { useTimetableStore } from '../store/timetableStore';

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

  const generateSchedule = useTimetableStore((state) => state.generateSchedule);

  const generate = useCallback(async () => {
    if (!config || classes.length === 0 || subjects.length === 0 || teachers.length === 0) {
      alert('설정, 학급, 과목, 교사 정보를 모두 입력해주세요.');
      return;
    }

    // 광고 표시
    await showInterstitial();

    try {
      await generateSchedule(1, 10);
    } catch (error) {
      console.error('시간표 생성 실패:', error);
      alert('시간표 생성에 실패했습니다.');
    }
  }, [config, classes, subjects, teachers, generateSchedule, showInterstitial]);

  const generateMultiple = useCallback(async (minCount: number = 3) => {
    if (!config || classes.length === 0 || subjects.length === 0 || teachers.length === 0) {
      alert('설정, 학급, 과목, 교사 정보를 모두 입력해주세요.');
      return;
    }

    // 광고 표시
    await showInterstitial();

    try {
      await generateSchedule(minCount, 50);
    } catch (error) {
      console.error('시간표 생성 실패:', error);
      alert('시간표 생성에 실패했습니다.');
    }
  }, [config, classes, subjects, teachers, generateSchedule, showInterstitial]);

  return {
    generate,
    generateMultiple,
    generateClasses
  };
};

