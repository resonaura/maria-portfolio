import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm';
import { SourceFile } from './source-file.entity.js';

@Entity('cache_variants')
@Index(['sourceFile', 'variantKey'], { unique: true })
export class CacheVariant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => SourceFile, (source) => source.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sourceFileId' })
  sourceFile!: SourceFile;

  @Column({ type: 'text' })
  sourceFileId!: string;

  // Denormalized copy of the source hash this variant was built from —
  // lets reconciliation detect "stale but present" rows without a join.
  @Column({ type: 'text' })
  sourceContentHash!: string;

  // Canonical string identifying the transform, e.g. "w=640;f=avif;q=80" or "vector".
  @Column({ type: 'text' })
  variantKey!: string;

  @Column({ type: 'text' })
  format!: string;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  quality!: number | null;

  @Column({ type: 'text' })
  filename!: string;

  @Column({ type: 'integer' })
  sizeBytes!: number;

  @CreateDateColumn()
  createdAt!: Date;
}
