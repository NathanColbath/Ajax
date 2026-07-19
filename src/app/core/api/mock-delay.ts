import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';

/** Simulate network latency for mock responses. */
export function mockDelay<T>(value: T, ms = 280): Observable<T> {
  return of(value).pipe(delay(ms));
}
