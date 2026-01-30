#!/usr/bin/env node

import { createProgram } from './cli/index';

const program = createProgram();
program.parse();