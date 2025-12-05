import { AggregateMethod, ChartType } from '../types';
import { ColumnProfileMap, ColumnValueType } from './columnProfiles';
import { FieldConstraint, getFieldConstraints, ChartFieldKey } from '../constants/chartFieldConstraints';

export interface ChartFieldState {
  dimension: string;
  stackBy: string;
  measure: AggregateMethod;
  measureCol: string;
  xDimension: string;
  yDimension: string;
  sizeDimension: string;
  colorBy: string;
}

export type FieldErrorMap = Partial<Record<ChartFieldKey, string>>;

const satisfiesType = (profile: ColumnProfileMap[string] | undefined, allowed: ColumnValueType[]) => {
  if (!profile) return false;
  return allowed.includes(profile.type);
};

export const buildFieldErrors = (
  chartType: ChartType | null,
  state: ChartFieldState,
  columnProfiles: ColumnProfileMap
): FieldErrorMap => {
  if (!chartType) return {};
  const constraints = getFieldConstraints(chartType);
  const errors: FieldErrorMap = {};

  constraints.forEach((constraint) => {
    const value = state[constraint.key] as string;

    if (constraint.key === 'measureCol' && (state.measure === 'count')) {
      return; // not required for Count
    }

    if (constraint.required && !value) {
      errors[constraint.key] = 'จำเป็นต้องเลือกคอลัมน์นี้';
      return;
    }

    if (value) {
      const profile = columnProfiles[value];
      if (!satisfiesType(profile, constraint.allowedTypes)) {
        errors[constraint.key] = `ต้องเป็นข้อมูลประเภท ${constraint.allowedTypes.map(t => {
          switch (t) {
            case 'number':
              return 'Number';
            case 'date':
              return 'Date';
            default:
              return 'Text';
          }
        }).join('/')}`;
      }
    }
  });

  if ((state.measure === 'sum' || state.measure === 'avg') && !state.measureCol) {
    errors.measureCol = 'ต้องเลือกคอลัมน์เพื่อคำนวณ';
  }

  return errors;
};

export const hasBlockingErrors = (errors: FieldErrorMap) =>
  Object.values(errors).some(Boolean);

export const getConstraintsForType = (chartType: ChartType | null): FieldConstraint[] =>
  chartType ? getFieldConstraints(chartType) : [];
