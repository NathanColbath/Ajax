import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { ApiClient, ApiModeService, mockDelay } from '../../core/api';
import { MOCK_PHYSICAL } from './physical.mock';
import { PhysicalItem } from './physical.models';

@Injectable({ providedIn: 'root' })
export class PhysicalApi {
  private readonly mode = inject(ApiModeService);
  private readonly http = inject(ApiClient);
  private store = MOCK_PHYSICAL.map((item) => ({ ...item }));

  list(locationId?: string): Observable<PhysicalItem[]> {
    if (this.mode.isMock()) {
      const items = locationId
        ? this.store.filter((i) => i.locationId === locationId)
        : [...this.store];
      return mockDelay(items);
    }
    return this.http.get<PhysicalItem[]>('/physical', { locationId });
  }

  toggleCheckout(id: string, borrower = 'Guest'): Observable<PhysicalItem> {
    if (this.mode.isMock()) {
      const item = this.store.find((i) => i.id === id);
      if (!item) {
        return throwError(() => new Error('Item not found'));
      }
      item.checkedOut = !item.checkedOut;
      item.borrower = item.checkedOut ? borrower : undefined;
      return mockDelay({ ...item }, 200);
    }
    return this.http.post<PhysicalItem>(`/physical/${id}/checkout`);
  }
}
