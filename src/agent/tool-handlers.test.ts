import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createToolHandlers } from './tool-handlers.js';
import { PlanState } from '../services/plan-state.js';
import { KnowledgeBase } from '../services/knowledge-base.js';
import type { Profile, Pantry } from '../schemas/index.js';

describe('ToolHandlers', () => {
  const mockProfile: Profile = {
    goals: {
      dailyCalories: { min: 1800, max: 2200 },
      macros: {
        protein: { min: 100, max: 150 },
        carbs: { min: 200, max: 300 },
        fat: { min: 50, max: 80 },
        fiber: { min: 25, max: 40 },
      },
      weeklyBudget: 150,
    },
    dietary: { restrictions: [], dislikes: [] },
    preferences: {
      cuisines: [],
      maxPrepTime: {
        monday: 30,
        tuesday: 30,
        wednesday: 30,
        thursday: 30,
        friday: 30,
        saturday: 60,
        sunday: 60,
      },
      complexityTolerance: 'medium',
    },
    constraints: { skillLevel: 'intermediate', kitchenware: [] },
    household: {
      size: 2,
      members: [
        {
          name: 'User',
          dietaryRestrictions: [],
        },
        {
          name: 'Partner',
          dietaryRestrictions: ['vegetarian'],
        },
      ],
    },
    learned: {
      lovedMeals: [],
      dislikedMeals: [],
      patterns: [],
    },
  };

  const mockPantry: Pantry = { items: [] };

  let planState: PlanState;
  let kb: KnowledgeBase;
  let handlers: ReturnType<typeof createToolHandlers>;

  beforeEach(() => {
    planState = new PlanState('2026-W05', mockProfile, mockPantry);
    kb = {
      getIngredient: vi.fn(),
      saveIngredient: vi.fn(),
      searchIngredients: vi.fn(),
      getAllIngredients: vi.fn(),
    } as unknown as KnowledgeBase;
    handlers = createToolHandlers(planState, kb, null);
  });

  describe('get_plan_state', () => {
    it('returns current plan summary', async () => {
      const result = await handlers.handle('get_plan_state', {});
      expect(result).toHaveProperty('mealsPlanned', 0);
      expect(result).toHaveProperty('weeklyTotals');
      expect(result).toHaveProperty('remainingBudget');
    });
  });

  describe('lookup_ingredient', () => {
    it('returns ingredient from knowledge base if found', async () => {
      const ingredient = {
        name: 'chicken breast',
        pricePerUnit: 10,
        unit: 'kg',
        unitWeightGrams: 1000,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        fiberPer100g: 0,
        confidence: 'usda' as const,
        lastUpdated: '2026-01-30',
      };
      (kb.getIngredient as ReturnType<typeof vi.fn>).mockResolvedValue(
        ingredient
      );

      const result = await handlers.handle('lookup_ingredient', {
        name: 'chicken breast',
      });

      expect(result).toEqual({
        found: true,
        source: 'knowledge_base',
        ingredient,
      });
    });

    it('returns not found if ingredient missing and no USDA client', async () => {
      (kb.getIngredient as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await handlers.handle('lookup_ingredient', {
        name: 'unknown food',
      });

      expect(result).toEqual({
        found: false,
        message: 'Ingredient not found. No USDA API configured.',
      });
    });
  });
});
