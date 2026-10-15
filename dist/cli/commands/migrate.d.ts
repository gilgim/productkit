import type { Command } from 'commander';
import type { Output } from '../output.js';
export declare function runMigrate(options: {
    cwd?: string;
    dryRun?: boolean;
    resume?: boolean;
    rollback?: boolean;
}, output: Output): Promise<void>;
export declare function registerMigrateCommand(program: Command, output: Output): void;
