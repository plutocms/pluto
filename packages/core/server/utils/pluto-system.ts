import type { H3Event } from 'h3'

const SYSTEM_KEY = 'plutoSystem'

/**
 * A request of Pluto itself, with no user: a scheduled task, such as the purge of the trash. An
 * adapter gives it the server credentials of its backend (the GitHub App for the Git CMS, the
 * service key for Supabase) and every capability. A task makes one with `createPlutoSystemEvent`;
 * `event.context` exists only on the server, so a request from outside can never be one.
 */
export function createPlutoSystemEvent(): H3Event {
  return {
    context: { [SYSTEM_KEY]: true },
    path: '/_pluto/system',
    method: 'POST',
    headers: new Headers(),
    node: { req: { headers: {} }, res: {} },
  } as unknown as H3Event
}

/** True for an event of `createPlutoSystemEvent`. */
export function isPlutoSystemEvent(event: H3Event | undefined): boolean {
  return event?.context?.[SYSTEM_KEY] === true
}
