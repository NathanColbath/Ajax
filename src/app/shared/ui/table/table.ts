import { Component, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';

export interface AjaxTableColumn<T = any> {
  key: string;
  header: string;
  cell?: (row: T) => string | number | null | undefined;
}

@Component({
  selector: 'ajax-table',
  standalone: true,
  imports: [MatTableModule],
  template: `
    <div class="ajax-table-wrap">
      <table mat-table [dataSource]="data()" class="ajax-table">
        @for (column of columns(); track column.key) {
          <ng-container [matColumnDef]="column.key">
            <th mat-header-cell *matHeaderCellDef>{{ column.header }}</th>
            <td mat-cell *matCellDef="let row">
              {{ column.cell ? column.cell(row) : $any(row)[column.key] }}
            </td>
          </ng-container>
        }

        <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>

        <tr class="mat-mdc-row ajax-table-empty" *matNoDataRow>
          <td class="mat-mdc-cell" [attr.colspan]="columns().length">{{ emptyMessage() }}</td>
        </tr>
      </table>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .ajax-table-wrap {
      width: 100%;
      overflow: auto;
    }

    .ajax-table {
      width: 100%;
    }

    .ajax-table-empty td {
      padding: 1.25rem;
      text-align: center;
      opacity: 0.7;
    }
  `,
})
export class AjaxTable {
  readonly columns = input<AjaxTableColumn<any>[]>([]);
  readonly data = input<readonly any[]>([]);
  readonly emptyMessage = input('No data available');

  displayedColumns(): string[] {
    return this.columns().map((column) => column.key);
  }
}
