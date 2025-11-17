// 최적화 휴리스틱 (Simulated Annealing, Genetic Algorithm)

import { TimetableData, GenerationResult } from '../types';
import { ConstraintValidator } from '../core/validator';
import { SoftConstraintScorer } from '../core/scorer';

export class OptimizationHeuristics {
  /**
   * Simulated Annealing: 현재 해를 개선
   */
  static simulatedAnnealing(
    currentData: TimetableData,
    initialTemperature: number = 1000,
    coolingRate: number = 0.95,
    maxIterations: number = 1000
  ): TimetableData {
    let bestData = JSON.parse(JSON.stringify(currentData)) as TimetableData;
    let currentDataCopy = JSON.parse(JSON.stringify(currentData)) as TimetableData;
    let temperature = initialTemperature;

    const bestScore = SoftConstraintScorer.calculateTotalScore(bestData);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // 현재 해에서 랜덤하게 두 배정 교환
      const neighbor = this.generateNeighbor(currentDataCopy);

      if (!neighbor) continue;

      const currentScore = SoftConstraintScorer.calculateTotalScore(currentDataCopy);
      const neighborScore = SoftConstraintScorer.calculateTotalScore(neighbor);

      // 하드 제약조건 위반 확인
      const violations = ConstraintValidator.validateTimetable(neighbor);
      if (!violations.summary.isFeasible) {
        continue; // 하드 제약조건 위반 시 무시
      }

      // 수락 확률 계산
      const delta = neighborScore - currentScore;
      const acceptProbability = delta < 0 ? 1 : Math.exp(-delta / temperature);

      if (Math.random() < acceptProbability) {
        currentDataCopy = neighbor;
        if (neighborScore < bestScore) {
          bestData = neighbor;
        }
      }

      // 온도 감소
      temperature *= coolingRate;
    }

    return bestData;
  }

  /**
   * 이웃 해 생성 (두 배정 교환)
   */
  private static generateNeighbor(data: TimetableData): TimetableData | null {
    const neighbor = JSON.parse(JSON.stringify(data)) as TimetableData;

    // 랜덤하게 두 개의 배정 선택
    const assignments: Array<{ classId: string; day: string; period: number }> = [];

    for (const classId of Object.keys(neighbor.timetable)) {
      const classSchedule = neighbor.timetable[classId];
      for (const day of neighbor.schoolConfig.days) {
        const daySchedule = classSchedule[day];
        if (!daySchedule) continue;

        const maxPeriod = neighbor.schoolConfig.periodsPerDay[day];
        for (let period = 1; period <= maxPeriod; period++) {
          if (daySchedule[period]) {
            assignments.push({ classId, day, period });
          }
        }
      }
    }

    if (assignments.length < 2) {
      return null;
    }

    // 두 배정 선택
    const idx1 = Math.floor(Math.random() * assignments.length);
    let idx2 = Math.floor(Math.random() * assignments.length);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * assignments.length);
    }

    const a1 = assignments[idx1];
    const a2 = assignments[idx2];

    // 교환
    const temp = neighbor.timetable[a1.classId][a1.day as keyof typeof neighbor.timetable[a1.classId]][a1.period];
    neighbor.timetable[a1.classId][a1.day as keyof typeof neighbor.timetable[a1.classId]][a1.period] =
      neighbor.timetable[a2.classId][a2.day as keyof typeof neighbor.timetable[a2.classId]][a2.period];
    neighbor.timetable[a2.classId][a2.day as keyof typeof neighbor.timetable[a2.classId]][a2.period] = temp;

    // 교사 시간표도 업데이트
    // (간단화를 위해 생략, 실제로는 교사 시간표도 함께 업데이트해야 함)

    return neighbor;
  }

  /**
   * Genetic Algorithm: 여러 해를 교차 및 돌연변이하여 개선
   */
  static geneticAlgorithm(
    population: TimetableData[],
    generations: number = 50,
    mutationRate: number = 0.1
  ): TimetableData {
    let currentPopulation = [...population];

    for (let gen = 0; gen < generations; gen++) {
      // 적합도 평가
      const fitnessScores = currentPopulation.map(data => {
        const violations = ConstraintValidator.validateTimetable(data);
        if (!violations.summary.isFeasible) {
          return -Infinity; // 하드 제약조건 위반은 제외
        }
        const score = SoftConstraintScorer.calculateTotalScore(data);
        return -score; // 낮을수록 좋으므로 음수로 변환
      });

      // 선택 (상위 50%)
      const sorted = currentPopulation
        .map((data, idx) => ({ data, fitness: fitnessScores[idx] }))
        .sort((a, b) => b.fitness - a.fitness);

      const selected = sorted.slice(0, Math.floor(currentPopulation.length / 2)).map(s => s.data);

      // 교차 및 돌연변이로 새로운 세대 생성
      const newPopulation: TimetableData[] = [];

      while (newPopulation.length < currentPopulation.length) {
        // 부모 선택
        const parent1 = selected[Math.floor(Math.random() * selected.length)];
        const parent2 = selected[Math.floor(Math.random() * selected.length)];

        // 교차
        const child = this.crossover(parent1, parent2);

        // 돌연변이
        if (Math.random() < mutationRate) {
          this.mutate(child);
        }

        newPopulation.push(child);
      }

      currentPopulation = newPopulation;
    }

    // 최적 해 반환
    const finalFitness = currentPopulation.map(data => {
      const violations = ConstraintValidator.validateTimetable(data);
      if (!violations.summary.isFeasible) {
        return -Infinity;
      }
      return -SoftConstraintScorer.calculateTotalScore(data);
    });

    const bestIdx = finalFitness.indexOf(Math.max(...finalFitness));
    return currentPopulation[bestIdx];
  }

  /**
   * 교차 (Crossover)
   */
  private static crossover(parent1: TimetableData, parent2: TimetableData): TimetableData {
    const child = JSON.parse(JSON.stringify(parent1)) as TimetableData;

    // 랜덤하게 일부 학급의 시간표를 parent2에서 가져옴
    const classIds = Object.keys(child.timetable);
    const crossoverCount = Math.floor(classIds.length / 2);

    for (let i = 0; i < crossoverCount; i++) {
      const classId = classIds[Math.floor(Math.random() * classIds.length)];
      if (parent2.timetable[classId]) {
        child.timetable[classId] = JSON.parse(JSON.stringify(parent2.timetable[classId]));
      }
    }

    return child;
  }

  /**
   * 돌연변이 (Mutation)
   */
  private static mutate(data: TimetableData): void {
    // 랜덤하게 하나의 배정을 다른 시간대로 이동
    const classIds = Object.keys(data.timetable);
    const classId = classIds[Math.floor(Math.random() * classIds.length)];
    const classSchedule = data.timetable[classId];

    const days = data.schoolConfig.days;
    const day = days[Math.floor(Math.random() * days.length)];
    const daySchedule = classSchedule[day];

    if (!daySchedule) return;

    const maxPeriod = data.schoolConfig.periodsPerDay[day];
    const periods = Array.from({ length: maxPeriod }, (_, i) => i + 1);
    const period = periods[Math.floor(Math.random() * periods.length)];

    const assignment = daySchedule[period];
    if (!assignment) return;

    // 다른 시간대로 이동 시도
    const newDay = days[Math.floor(Math.random() * days.length)];
    const newMaxPeriod = data.schoolConfig.periodsPerDay[newDay];
    const newPeriod = Math.floor(Math.random() * newMaxPeriod) + 1;

    // 이동
    delete daySchedule[period];
    if (!classSchedule[newDay]) {
      classSchedule[newDay] = {};
    }
    classSchedule[newDay][newPeriod] = assignment;
    assignment.day = newDay;
    assignment.period = newPeriod;
  }
}
