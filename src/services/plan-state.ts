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

type BudgetStatus = 'under' | 'in_range' | 'over';

interface MacroBudget {
  min: number;
  max: number;
  status: BudgetStatus;
}

interface RemainingBudget {
  calories: MacroBudget;
  macros: {
    protein: MacroBudget;
    carbs: MacroBudget;
    fat: MacroBudget;
    fiber: MacroBudget;
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

  private computeStatus(min: number, max: number): BudgetStatus {
    // min = weeklyTarget.min - current, max = weeklyTarget.max - current
    // If min > 0: need more (under target minimum)
    // If max < 0: have too much (over target maximum)
    // If min <= 0 && max >= 0: within range
    if (min > 0) return 'under';
    if (max < 0) return 'over';
    return 'in_range';
  }

  getRemainingBudget(): RemainingBudget {
    const summary = this.getSummary();
    const { goals } = this.profile;

    // Weekly targets = daily targets * 7
    const weeklyCalMin = goals.dailyCalories.min * 7;
    const weeklyCalMax = goals.dailyCalories.max * 7;

    const calMin = weeklyCalMin - summary.weeklyTotals.calories;
    const calMax = weeklyCalMax - summary.weeklyTotals.calories;

    const proteinMin =
      goals.macros.protein.min * 7 - summary.weeklyTotals.macros.protein;
    const proteinMax =
      goals.macros.protein.max * 7 - summary.weeklyTotals.macros.protein;

    const carbsMin =
      goals.macros.carbs.min * 7 - summary.weeklyTotals.macros.carbs;
    const carbsMax =
      goals.macros.carbs.max * 7 - summary.weeklyTotals.macros.carbs;

    const fatMin = goals.macros.fat.min * 7 - summary.weeklyTotals.macros.fat;
    const fatMax = goals.macros.fat.max * 7 - summary.weeklyTotals.macros.fat;

    const fiberMin =
      goals.macros.fiber.min * 7 - summary.weeklyTotals.macros.fiber;
    const fiberMax =
      goals.macros.fiber.max * 7 - summary.weeklyTotals.macros.fiber;

    return {
      calories: {
        min: calMin,
        max: calMax,
        status: this.computeStatus(calMin, calMax),
      },
      macros: {
        protein: {
          min: proteinMin,
          max: proteinMax,
          status: this.computeStatus(proteinMin, proteinMax),
        },
        carbs: {
          min: carbsMin,
          max: carbsMax,
          status: this.computeStatus(carbsMin, carbsMax),
        },
        fat: {
          min: fatMin,
          max: fatMax,
          status: this.computeStatus(fatMin, fatMax),
        },
        fiber: {
          min: fiberMin,
          max: fiberMax,
          status: this.computeStatus(fiberMin, fiberMax),
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
