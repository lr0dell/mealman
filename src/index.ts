#!/usr/bin/env node

import dotenv from 'dotenv';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createProgram } from './cli/index.js';

dotenv.config({ path: join(homedir(), '.meal-planner', '.env') });

const program = createProgram();
program.parse();
