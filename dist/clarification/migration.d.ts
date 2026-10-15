export type MigrationState = 'dry_run' | 'committed' | 'already_current' | 'resumed' | 'rolled_back' | 'already_rolled_back';
export type MigrationCheckpoint = 'backup_published' | 'journal_prepared' | 'target_written' | 'config_replaced' | 'journal_committed';
export type MigrationIoPoint = 'backup_publish' | 'journal_prepare' | 'target_write' | 'config_replace' | 'journal_commit';
export interface MigrationOptions {
    dryRun?: boolean;
    resume?: boolean;
    rollback?: boolean;
    now?: Date;
    interruptAt?: MigrationCheckpoint;
    failAt?: MigrationIoPoint;
}
export interface MigrationResult {
    state: MigrationState;
    source_hash?: string;
    target_hash?: string;
    backup_path: string;
    plan?: string[];
}
export declare function migrateWorkspace(productRoot: string, options?: MigrationOptions): Promise<MigrationResult>;
