import { BadGatewayException, BadRequestException } from '@nestjs/common';
import { semesterGrade, semesterPeriods } from './semester-source';

describe('Semester source interpretation', () => {
  const item = { id: 10, itemtype: 'course', itemname: 'Математика', graderaw: 0, grademin: 0, grademax: 100, gradeformatted: '0', gradedategraded: 1792600000 };
  it('keeps a real zero distinct from missing grades without inventing a debt', () => {
    expect(semesterGrade(item)).toMatchObject({ raw: 0, display: '0', minimum: 0 });
    expect(semesterGrade({ ...item, graderaw: undefined })).toMatchObject({ raw: null });
    expect(semesterGrade(item)).not.toHaveProperty('debt');
  });
  it('does not disclose numeric/display/date values hidden by the source', () => {
    expect(semesterGrade({ ...item, gradeishidden: true })).toMatchObject({ raw: null, display: null, gradedAt: null, maximum: null });
    expect(semesterGrade({ ...item, gradehiddenbydate: 1 })).toMatchObject({ raw: null, display: null });
  });
  it('marks grades needing recalculation instead of presenting stale values', () => {
    expect(semesterGrade({ ...item, gradeneedsupdate: true })).toMatchObject({ stale: true, raw: null, display: null });
  });
  it('rejects malformed visibility rather than treating it as public', () => {
    expect(() => semesterGrade({ ...item, gradeishidden: 'true' })).toThrow(BadGatewayException);
  });
  it('does not return HTML or throw on an out-of-range source timestamp', () => {
    expect(semesterGrade({ ...item, itemname: '<b>Предмет</b>', gradeformatted: '<script>alert(1)</script>', gradedategraded: Number.MAX_SAFE_INTEGER })).toMatchObject({ name: 'Предмет', gradedAt: null });
  });
  it('distinguishes unconfigured periods from invalid or ambiguous configuration', () => {
    expect(semesterPeriods(undefined)).toEqual([]);
    expect(semesterPeriods([{ id: '2026-autumn', label: 'Осень 2026', courseIds: [1, 2] }])).toHaveLength(1);
    expect(() => semesterPeriods([{ id: '2026', label: 'Период', courseIds: [1, 1] }])).toThrow(BadRequestException);
    expect(() => semesterPeriods([{ id: '2026', label: 'Период', courseIds: [0] }])).toThrow(BadRequestException);
  });
});
