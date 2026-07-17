import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { CacheVariant } from './cache-variant.entity.js';

export type SourceFileKind = 'raster' | 'svg-vector' | 'svg-with-raster';

@Entity('source_files')
export class SourceFile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  relativePath!: string;

  @Column({ type: 'text' })
  contentHash!: string;

  @Column({ type: 'integer' })
  size!: number;

  @Column({ type: 'float' })
  mtimeMs!: number;

  @Column({ type: 'text' })
  kind!: SourceFileKind;

  @Column({ type: 'integer', nullable: true })
  width!: number | null;

  @Column({ type: 'integer', nullable: true })
  height!: number | null;

  @Column({ type: 'text', default: '' })
  lqip!: string;

  @OneToMany(() => CacheVariant, (variant) => variant.sourceFile)
  variants!: CacheVariant[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
