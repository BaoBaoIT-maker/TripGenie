import { normalizeTourBriefing, redactTourBriefing } from './tour-briefing.util';

describe('tour-briefing.util', () => {
  const full = {
    leaderName: 'Linh',
    leaderPhone: '0905123456',
    meetingPoint: '06:00 Sân bay',
    notes: 'Mang CCCD',
  };

  it('normalizeTourBriefing trims fields and returns null when everything is blank', () => {
    expect(normalizeTourBriefing({ ...full, leaderName: '  Linh  ' })?.leaderName).toBe('Linh');
    expect(normalizeTourBriefing({ leaderName: ' ', leaderPhone: '', notes: undefined })).toBeNull();
  });

  it('redactTourBriefing keeps everything for owner / trip members', () => {
    expect(redactTourBriefing(full, true)).toEqual(full);
  });

  it('redactTourBriefing hides phone and notes from outsiders but keeps name and meeting point', () => {
    expect(redactTourBriefing(full, false)).toEqual({
      leaderName: 'Linh',
      leaderPhone: null,
      meetingPoint: '06:00 Sân bay',
      notes: null,
    });
  });

  it('redactTourBriefing returns null when only private fields were set', () => {
    expect(redactTourBriefing({ leaderPhone: '0905123456', notes: 'x' }, false)).toBeNull();
    expect(redactTourBriefing(null, false)).toBeNull();
  });
});
