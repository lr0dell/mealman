#!/usr/bin/env node

import 'dotenv/config';
import { createProgram } from './cli/index.js';

const program = createProgram();
program.parse();
