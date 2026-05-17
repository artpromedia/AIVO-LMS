import { describe, it, expect } from 'vitest';
import { mapInboxUrlToMobileRoute } from '../lib/inboxLinks';

describe('mapInboxUrlToMobileRoute', () => {
  it('maps relative learner IEP URL', () => {
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/abc123/iep')).toEqual({
      pathname: '/(parent)/iep/[childId]',
      params: { childId: 'abc123' },
    });
  });

  it('maps absolute learner brain URL', () => {
    expect(
      mapInboxUrlToMobileRoute('https://app.aivo.ai/dashboard/parent/learner/abc/brain'),
    ).toEqual({
      pathname: '/(parent)/brain/[childId]',
      params: { childId: 'abc' },
    });
  });

  it('maps brain-review alias to brain', () => {
    expect(
      mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/brain-review'),
    ).toEqual({ pathname: '/(parent)/brain/[childId]', params: { childId: 'x' } });
  });

  it('maps milestones, team, progress, overview', () => {
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/milestones')).toEqual({
      pathname: '/(parent)/milestones/[childId]',
      params: { childId: 'x' },
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/team')).toEqual({
      pathname: '/(parent)/team/[childId]',
      params: { childId: 'x' },
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/progress')).toEqual({
      pathname: '/(parent)/progress/[childId]',
      params: { childId: 'x' },
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/overview')).toEqual({
      pathname: '/(parent)/progress/[childId]',
      params: { childId: 'x' },
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/x')).toEqual({
      pathname: '/(parent)/progress/[childId]',
      params: { childId: 'x' },
    });
  });

  it('strips query and hash', () => {
    expect(
      mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/iep?utm=email#goals'),
    ).toEqual({
      pathname: '/(parent)/iep/[childId]',
      params: { childId: 'x' },
    });
  });

  it('maps top-level parent surfaces', () => {
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/recommendations')).toEqual({
      pathname: '/(parent)/recommendations',
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/inbox')).toEqual({
      pathname: '/(parent)/inbox',
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/billing')).toEqual({
      pathname: '/(parent)/billing',
    });
    expect(mapInboxUrlToMobileRoute('/dashboard/parent')).toEqual({
      pathname: '/(parent)',
    });
  });

  it('returns null for unsupported targets so caller can fall back', () => {
    expect(mapInboxUrlToMobileRoute('/dashboard/parent/learner/x/transitions')).toBeNull();
    expect(mapInboxUrlToMobileRoute('/dashboard/teacher/learner/x')).toBeNull();
    expect(mapInboxUrlToMobileRoute('https://www.example.com/foo')).toBeNull();
    expect(mapInboxUrlToMobileRoute('')).toBeNull();
    expect(mapInboxUrlToMobileRoute(null)).toBeNull();
    expect(mapInboxUrlToMobileRoute(undefined)).toBeNull();
  });

  it('handles malformed URLs gracefully', () => {
    expect(mapInboxUrlToMobileRoute('http://')).toBeNull();
  });
});
