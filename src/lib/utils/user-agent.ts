/**
 * Component: User-Agent Constant
 *
 * Centralized User-Agent string used for all outbound HTTP requests.
 * Replaces the default `axios/x.y.z` UA, which is rejected by some
 * indexers (e.g., NZBFinder) as a generic-bot signature.
 */

import { version } from '../../../package.json';

export const RMAB_USER_AGENT = `ReadMeABook/${version}`;
