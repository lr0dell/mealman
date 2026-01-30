export interface USDANutrients {
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
}

export interface USDASearchResult {
  fdcId: number;
  description: string;
  nutrients: USDANutrients;
}

interface USDAFoodNutrient {
  nutrientId: number;
  value: number;
}

interface USDASearchResponse {
  foods: Array<{
    fdcId: number;
    description: string;
    foodNutrients: USDAFoodNutrient[];
  }>;
}

// USDA nutrient IDs
const NUTRIENT_IDS = {
  PROTEIN: 1003, // Protein
  CARBS: 1005, // Carbohydrate, by difference
  FAT: 1004, // Total lipid (fat)
  FIBER: 1079, // Fiber, total dietary
};

export class USDAClient {
  private apiKey: string;
  private baseUrl = 'https://api.nal.usda.gov/fdc/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  static parseNutrients(foodNutrients: USDAFoodNutrient[]): USDANutrients {
    const getValue = (nutrientId: number): number => {
      const nutrient = foodNutrients.find((n) => n.nutrientId === nutrientId);
      return nutrient?.value ?? 0;
    };

    return {
      proteinPer100g: getValue(NUTRIENT_IDS.PROTEIN),
      carbsPer100g: getValue(NUTRIENT_IDS.CARBS),
      fatPer100g: getValue(NUTRIENT_IDS.FAT),
      fiberPer100g: getValue(NUTRIENT_IDS.FIBER),
    };
  }

  async searchFood(query: string): Promise<USDASearchResult[]> {
    const url = new URL(`${this.baseUrl}/foods/search`);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '5');
    url.searchParams.set('dataType', 'Foundation,SR Legacy');

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(
        `USDA API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as USDASearchResponse;

    return data.foods.map((food) => ({
      fdcId: food.fdcId,
      description: food.description,
      nutrients: USDAClient.parseNutrients(food.foodNutrients),
    }));
  }
}
