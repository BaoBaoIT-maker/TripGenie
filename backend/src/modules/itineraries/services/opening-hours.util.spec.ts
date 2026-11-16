import { evaluateOpeningStatus } from './opening-hours.util';

describe('evaluateOpeningStatus', () => {
  it('handles 24/7 raw schedule even without date or time', () => {
    expect(evaluateOpeningStatus({ raw: '24/7' }, null, null)).toEqual({
      state: 'OPEN',
      label: 'Mở cửa 24/7',
      todayHours: '24/7',
    });
  });

  it('evaluates weekday map accurately when scheduled inside vs outside opening hours', () => {
    const oh = {
      monday: '07:00-22:30',
      tuesday: '07:00-22:30',
      wednesday: '07:00-22:30',
      thursday: '07:00-22:30',
      friday: '07:00-22:30',
      saturday: '07:00-23:00',
      sunday: '07:00-23:00',
    };

    // 2026-11-14 is Saturday
    expect(evaluateOpeningStatus(oh, '2026-11-14', '22:45')).toMatchObject({
      state: 'OPEN',
      todayHours: '07:00-23:00',
    });
    expect(evaluateOpeningStatus(oh, '2026-11-13', '22:45')).toMatchObject({
      state: 'CLOSED',
      todayHours: '07:00-22:30',
    });
  });

  it('parses OSM raw strings with day ranges and am/pm formats', () => {
    // 2026-11-15 is Sunday; Mo-Sa means closed on Sunday
    expect(
      evaluateOpeningStatus(
        { raw: 'Mo-Sa 06:00-21:00' },
        '2026-11-15',
        '10:00',
      ),
    ).toMatchObject({
      state: 'CLOSED',
    });
    expect(
      evaluateOpeningStatus(
        { raw: 'Mo-Sa 06:00-21:00' },
        '2026-11-14',
        '10:00',
      ),
    ).toMatchObject({
      state: 'OPEN',
      todayHours: '06:00-21:00',
    });
    expect(
      evaluateOpeningStatus({ raw: '6 am - midnight' }, '2026-11-14', '23:00'),
    ).toMatchObject({
      state: 'OPEN',
    });
  });

  it('returns UNKNOWN for ambiguous noisy intervals like 06:00-06:00 or missing data', () => {
    expect(
      evaluateOpeningStatus(
        { raw: 'Mo-Su 06:00-06:00, 22:00-22:00' },
        '2026-11-14',
        '10:00',
      ).state,
    ).toBe('UNKNOWN');
    expect(evaluateOpeningStatus(null, '2026-11-14', '10:00').state).toBe(
      'UNKNOWN',
    );
  });
});
