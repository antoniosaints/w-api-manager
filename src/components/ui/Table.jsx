import React from 'react';
import {
  Table as ShadcnTable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../shadcn/table.jsx';

export function Table({ columns = [], rows = [], getKey = (row) => row.id, empty = 'Nenhum registro encontrado.', density = 'default' }) {
  return (
    <div className="data-table-wrap">
      <ShadcnTable className={`data-table density-${density}`}>
        <TableHeader>
          <TableRow>{columns.map((column) => <TableHead key={column.key}>{column.label}</TableHead>)}</TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getKey(row)}>
              {columns.map((column) => <TableCell key={column.key}>{column.render ? column.render(row) : row[column.key]}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </ShadcnTable>
      {!rows.length && <p className="empty">{empty}</p>}
    </div>
  );
}
