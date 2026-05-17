/**
 * Translate a web `actionUrl` (or any inbox notification link) to a mobile
 * route. Returns `null` if no equivalent mobile screen exists; callers should
 * fall back to "open on web" behaviour in that case.
 *
 * Inputs may be absolute (`https://app.aivo.ai/dashboard/parent/learner/123/iep`)
 * or relative (`/dashboard/parent/learner/123/iep`); both are normalised.
 */
export type MobileRoute =
  | { pathname: string; params?: Record<string, string> }
  | null;

const PARENT_LEARNER_RE = /^\/dashboard\/parent\/learner\/([^/]+)(?:\/([^/?#]+))?/;

export function mapInboxUrlToMobileRoute(input: string | null | undefined): MobileRoute {
  if (!input || typeof input !== 'string') return null;

  let path: string;
  try {
    if (/^https?:\/\//i.test(input)) {
      const u = new URL(input);
      path = u.pathname;
    } else {
      path = input.startsWith('/') ? input : `/${input}`;
      // Strip query/hash if any. split() always returns ≥1 element.
      path = path.split('?')[0] ?? path;
      path = path.split('#')[0] ?? path;
    }
  } catch {
    return null;
  }

  // /dashboard/parent/learner/:id[/sub]
  const m = path.match(PARENT_LEARNER_RE);
  if (m) {
    const childId = m[1] ?? '';
    const sub = m[2];
    switch (sub) {
      case undefined:
      case '':
      case 'overview':
      case 'progress':
        return { pathname: '/(parent)/progress/[childId]', params: { childId } };
      case 'iep':
        return { pathname: '/(parent)/iep/[childId]', params: { childId } };
      case 'brain':
      case 'brain-review':
        return { pathname: '/(parent)/brain/[childId]', params: { childId } };
      case 'team':
        return { pathname: '/(parent)/team/[childId]', params: { childId } };
      case 'milestones':
        return { pathname: '/(parent)/milestones/[childId]', params: { childId } };
      default:
        return null;
    }
  }

  if (path === '/dashboard/parent/recommendations' ||
      path.startsWith('/dashboard/parent/recommendations/')) {
    return { pathname: '/(parent)/recommendations' };
  }
  if (path === '/dashboard/parent/inbox' ||
      path.startsWith('/dashboard/parent/inbox/')) {
    return { pathname: '/(parent)/inbox' };
  }
  if (path === '/dashboard/parent/billing' ||
      path.startsWith('/dashboard/parent/billing/')) {
    return { pathname: '/(parent)/billing' };
  }
  if (path === '/dashboard/parent' || path === '/dashboard/parent/') {
    return { pathname: '/(parent)' };
  }

  return null;
}
