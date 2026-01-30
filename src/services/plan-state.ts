// src/services/plan-state.ts
import type { Profile, Pantry } from '../schemas/index.js';
import type { Meal, DayPlan, WeeklyPlan } from '../schemas/plan.js';

type MealSlot = 'breakfast' | 'lunch' | 'dinner';

interface DayMeals {
  breakfast: Meal | null;
  lunch: Meal | null;
  dinner: Meal | null;
}

interface PlanSummary {
  mealsPlanned: number;
  weeklyTotals: {
    calories: number;
    macros: { protein: number; carbs: number; fat: number; fiber: number };
    estimatedCost: number;
  };
  dayTotals: Map<
    string,
    {
      calories: number;
      macros: { protein: number; carbs: number; fat: number; fiber: number };
      estimatedCost: number;
    }
  >;
}

interface RemainingBudget {
  calories: { min: number; max: number };
  macros: {
    protein: { min: number; max: number };
    carbs: { min: number; max: number };
    fat: { min: number; max: number };
    fiber: { min: number; max: number };
  };
  cost: number;
}

export class PlanState {
  private week: string;
  private profile: Profile;
  private pantry: Pantry;
  private days: Map<string, DayMeals> = new Map();

  constructor(week: string, profile: Profile, pantry: Pantry) {
    this.week = week;
    this.profile = profile;
    this.pantry = pantry;
  }

  addMeal(date: string, slot: MealSlot, meal: Meal): void {
    if (!this.days.has(date)) {
      this.days.set(date, { breakfast: null, lunch: null, dinner: null });
    }
    const day = this.days.get(date)!;
    day[slot] = meal;
  }

  modifyMeal(date: string, slot: MealSlot, meal: Meal): void {
    this.addMeal(date, slot, meal);
  }

  removeMeal(date: string, slot: MealSlot): void {
    const day = this.days.get(date);
    if (day) {
      day[slot] = null;
    }
  }

  getMeal(date: string, slot: MealSlot): Meal | null {
    return this.days.get(date)?.[slot] ?? null;
  }

  getSummary(): PlanSummary {
    let mealsPlanned = 0;
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalCost = 0;

    const dayTotals = new Map<
      string,
      {
        calories: number;
        macros: { protein: number; carbs: number; fat: number; fiber: number };
        estimatedCost: number;
      }
    >();

    for (const [date, day] of this.days) {
      let dayCal = 0,
        dayPro = 0,
        dayCar = 0,
        dayFat = 0,
        dayFib = 0,
        dayCost = 0;

      for (const meal of [day.breakfast, day.lunch, day.dinner]) {
        if (meal) {
          mealsPlanned++;
          dayCal += meal.calories;
          dayPro += meal.macros.protein;
          dayCar += meal.macros.carbs;
          dayFat += meal.macros.fat;
          dayFib += meal.macros.fiber;
          dayCost += meal.estimatedCost;
        }
      }

      dayTotals.set(date, {
        calories: dayCal,
        macros: { protein: dayPro, carbs: dayCar, fat: dayFat, fiber: dayFib },
        estimatedCost: dayCost,
      });

      totalCalories += dayCal;
      totalProtein += dayPro;
      totalCarbs += dayCar;
      totalFat += dayFat;
      totalFiber += dayFib;
      totalCost += dayCost;
    }

    return {
      mealsPlanned,
      weeklyTotals: {
        calories: totalCalories,
        macros: {
          protein: totalProtein,
          carbs: totalCarbs,
          fat: totalFat,
          fiber: totalFiber,
        },
        estimatedCost: totalCost,
      },
      dayTotals,
    };
  }

  getRemainingBudget(): RemainingBudget {
    const summary = this.getSummary();
    const { goals } = this.profile;

    // Weekly targets = daily targets * 7
    const weeklyCalMin = goals.dailyCalories.min * 7;
    const weeklyCalMax = goals.dailyCalories.max * 7;

    return {
      calories: {
        min: weeklyCalMin - summary.weeklyTotals.calories,
        max: weeklyCalMax - summary.weeklyTotals.calories,
      },
      macros: {
        protein: {
          min:
            goals.macros.protein.min * 7 - summary.weeklyTotals.macros.protein,
          max:
            goals.macros.protein.max * 7 - summary.weeklyTotals.macros.protein,
        },
        carbs: {
          min: goals.macros.carbs.min * 7 - summary.weeklyTotals.macros.carbs,
          max: goals.macros.carbs.max * 7 - summary.weeklyTotals.macros.carbs,
        },
        fat: {
          min: goals.macros.fat.min * 7 - summary.weeklyTotals.macros.fat,
          max: goals.macros.fat.max * 7 - summary.weeklyTotals.macros.fat,
        },
        fiber: {
          min: goals.macros.fiber.min * 7 - summary.weeklyTotals.macros.fiber,
          max: goals.macros.fiber.max * 7 - summary.weeklyTotals.macros.fiber,
        },
      },
      cost: goals.weeklyBudget - summary.weeklyTotals.estimatedCost,
    };
  }

  getProfile(): Profile {
    return this.profile;
  }

  getPantry(): Pantry {
    return this.pantry;
  }

  getWeek(): string {
    return this.week;
  }

  toWeeklyPlan(): WeeklyPlan {
    const summary = this.getSummary();
    const days: DayPlan[] = [];

    for (const [date, dayMeals] of this.days) {
      days.push({
        date,
        meals: {
          breakfast: dayMeals.breakfast,
          lunch: dayMeals.lunch,
          dinner: dayMeals.dinner,
        },
      });
    }

    // Sort by date
    days.sort((a, b) => a.date.localeCompare(b.date));

    return {
      week: this.week,
      generatedAt: new Date().toISOString(),
      days,
      totals: {
        calories: summary.weeklyTotals.calories,
        macros: summary.weeklyTotals.macros,
        estimatedCost: summary.weeklyTotals.estimatedCost,
      },
    };
  }
}
