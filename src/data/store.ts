import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  ProfileSchema,
  PantrySchema,
  IngredientsKnowledgeSchema,
  WeeklyPlanSchema,
  type Profile,
  type Pantry,
} from '../schemas';
import { createDefaultProfile, createDefaultPantry } from '../schemas/defaults';

export class DataStore {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async init(): Promise<void> {
    const dirs = ['knowledge', 'plans', 'history'];
    for (const dir of dirs) {
      const path = join(this.dataDir, dir);
      if (!existsSync(path)) {
        await mkdir(path, { recursive: true });
      }
    }

    // Create default files if they don't exist
    if (!existsSync(this.profilePath)) {
      await this.saveProfile(createDefaultProfile());
    }
    if (!existsSync(this.pantryPath)) {
      await this.savePantry(createDefaultPantry());
    }
  }

  private get profilePath(): string {
    return join(this.dataDir, 'profile.json');
  }

  private get pantryPath(): string {
    return join(this.dataDir, 'pantry.json');
  }

  async getProfile(): Promise<Profile> {
    const content = await readFile(this.profilePath, 'utf-8');
    const data = JSON.parse(content);
    return ProfileSchema.parse(data);
  }

  async saveProfile(profile: Profile): Promise<void> {
    ProfileSchema.parse(profile); // Validate before saving
    await writeFile(this.profilePath, JSON.stringify(profile, null, 2));
  }

  async getPantry(): Promise<Pantry> {
    const content = await readFile(this.pantryPath, 'utf-8');
    const data = JSON.parse(content);
    return PantrySchema.parse(data);
  }

  async savePantry(pantry: Pantry): Promise<void> {
    PantrySchema.parse(pantry); // Validate before saving
    await writeFile(this.pantryPath, JSON.stringify(pantry, null, 2));
  }

  async getWeeklyPlan(week: string): Promise<WeeklyPlan | null> {
    const path = join(this.dataDir, 'plans', `${week}.json`);
    if (!existsSync(path)) {
      return null;
    }
    const content = await readFile(path, 'utf-8');
    const data = JSON.parse(content);
    return WeeklyPlanSchema.parse(data);
  }

  async saveWeeklyPlan(plan: WeeklyPlan): Promise<void> {
    WeeklyPlanSchema.parse(plan);
    const path = join(this.dataDir, 'plans', `${plan.week}.json`);
    await writeFile(path, JSON.stringify(plan, null, 2));
  }
}

type WeeklyPlan = import('../schemas').WeeklyPlan;